-- Уведомления близким через телеграм.
--
-- ПОЧЕМУ ТЕЛЕГРАМ. Обычные push-уведомления требуют Firebase или учётной
-- записи Expo, то есть ещё одного посредника и платного аккаунта Apple для
-- iPhone. Телеграм не требует ничего: родственник уже им пользуется, бот
-- доходит и до старого Android, и до iPhone, и до компьютера, а приложение
-- родственнику устанавливать не нужно вовсе — достаточно нажать «Start».
--
-- ЧТО УХОДИТ В ТЕЛЕГРАМ. Имя человека и то, что случилось: симптом или
-- долгое молчание телефона. Телеграм — сторонняя служба, и эта строка
-- покидает пределы нашей базы, поэтому в приложении есть выключатель
-- подробностей: при выключенном сообщение говорит только «нужно
-- проверить», без симптома. По умолчанию подробности включены —
-- предупреждение без причины бесполезно тому, кто за рулём и решает,
-- разворачиваться ли.
--
-- Токен бота живёт только в секретах Edge Functions. В приложение он не
-- попадает никогда: APK можно разобрать, и тогда чужой человек писал бы
-- от имени нашего бота.

-- ─────────────────────────────────────────────────────────────────────────
-- Код подписки
-- ─────────────────────────────────────────────────────────────────────────

alter table esla.profiles
  -- Отдельно от invite_code: тот одноразовый и привязывает приложение
  -- родственника, а этот нужен сразу нескольким близким и живёт дольше.
  add column if not exists telegram_code text unique,
  add column if not exists telegram_code_expires_at timestamptz,
  add column if not exists telegram_details boolean not null default true;

comment on column esla.profiles.telegram_details is
  'Писать ли в телеграм сам симптом. Выключено — только «нужно проверить».';

-- ─────────────────────────────────────────────────────────────────────────
-- Кому писать
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists esla.telegram_subscribers (
  id         bigserial primary key,
  patient_id uuid not null references esla.profiles(id) on delete cascade,
  -- Идентификатор переписки в телеграме. Телефон родственника нам не нужен.
  chat_id    bigint not null,
  -- Имя из телеграма: по нему человек узнаёт в списке, кто подписан.
  title      text,
  created_at timestamptz not null default now(),
  unique (patient_id, chat_id)
);

create index if not exists telegram_subscribers_patient_idx
  on esla.telegram_subscribers (patient_id);
create index if not exists telegram_subscribers_chat_idx
  on esla.telegram_subscribers (chat_id);

-- Журнал отправок. Он же защита от повторов: тревога, отмеченная трижды
-- подряд, не должна стать тремя сообщениями каждому родственнику.
create table if not exists esla.telegram_sends (
  id         bigserial primary key,
  patient_id uuid not null references esla.profiles(id) on delete cascade,
  kind       text not null check (kind in ('alarm', 'silence', 'test')),
  recipients int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists telegram_sends_patient_kind_idx
  on esla.telegram_sends (patient_id, kind, created_at desc);

alter table esla.telegram_subscribers enable row level security;
alter table esla.telegram_sends       enable row level security;

-- Человек видит, кто подписан на его тревоги, и может отписать любого.
-- Вставка только через функцию бота: напрямую привязать себя к чужому
-- пациенту нельзя, даже зная его id.
create policy telegram_subscribers_select_own on esla.telegram_subscribers
  for select using (patient_id = auth.uid());

create policy telegram_subscribers_delete_own on esla.telegram_subscribers
  for delete using (patient_id = auth.uid());

create policy telegram_sends_select_own on esla.telegram_sends
  for select using (patient_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- Выдать код подписки
-- ─────────────────────────────────────────────────────────────────────────

create or replace function esla.refresh_telegram_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = esla, pg_temp
as $$
declare
  new_code text;
  attempts int := 0;
begin
  loop
    new_code := esla.generate_invite_code();
    attempts := attempts + 1;
    exit when not exists (select 1 from esla.profiles p where p.telegram_code = new_code);
    if attempts > 20 then
      raise exception 'invite_code_generation_failed';
    end if;
  end loop;

  update esla.profiles
     set telegram_code = new_code,
         -- Неделя: за это время успеют подписаться все близкие, а потом
         -- подслушанный код уже ничего не даёт.
         telegram_code_expires_at = now() + interval '7 days',
         updated_at = now()
   where id = auth.uid()
  returning telegram_code, telegram_code_expires_at into code, expires_at;

  if code is null then
    raise exception 'profile_not_found';
  end if;

  return next;
end;
$$;

-- Погасить код досрочно: человек передумал.
create or replace function esla.revoke_telegram_code()
returns void
language sql
security definer
set search_path = esla, pg_temp
as $$
  update esla.profiles
     set telegram_code = null, telegram_code_expires_at = null, updated_at = now()
   where id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Что делает бот
-- ─────────────────────────────────────────────────────────────────────────

-- Подписать переписку на тревоги пациента по коду.
-- Вызывает только бот служебным ключом: приложению это не нужно и не дано.
create or replace function esla.link_telegram(p_code text, p_chat bigint, p_title text)
returns table (patient_id uuid, patient_name text)
language plpgsql
security definer
set search_path = esla, pg_temp
as $$
declare
  target uuid;
  target_name text;
begin
  select p.id, p.display_name into target, target_name
    from esla.profiles p
   where p.telegram_code = upper(trim(p_code))
     and p.telegram_code_expires_at > now()
     and p.role = 'patient';

  if target is null then
    raise exception 'code_not_found' using errcode = 'P0001';
  end if;

  insert into esla.telegram_subscribers (patient_id, chat_id, title)
  values (target, p_chat, p_title)
  on conflict (patient_id, chat_id)
    do update set title = excluded.title;

  return query select target, target_name;
end;
$$;

-- Отписать переписку от всего. Нажатие «/stop» должно работать всегда:
-- человек, который хочет перестать получать сообщения, не должен никого
-- об этом просить.
create or replace function esla.unlink_telegram(p_chat bigint)
returns integer
language plpgsql
security definer
set search_path = esla, pg_temp
as $$
declare
  removed integer;
begin
  delete from esla.telegram_subscribers where chat_id = p_chat;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Взять список получателей и сразу отметить отправку.
--
-- Одной операцией намеренно: иначе две одновременные тревоги прочитали бы
-- пустой журнал каждая и отправили бы по сообщению.
create or replace function esla.telegram_claim_send(
  p_patient uuid,
  p_kind text,
  p_cooldown interval
)
returns table (chat_id bigint)
language plpgsql
security definer
set search_path = esla, pg_temp
as $$
declare
  count_recipients integer;
begin
  if exists (
    select 1 from esla.telegram_sends s
     where s.patient_id = p_patient
       and s.kind = p_kind
       and s.created_at > now() - p_cooldown
  ) then
    return;
  end if;

  select count(*) into count_recipients
    from esla.telegram_subscribers t where t.patient_id = p_patient;

  if count_recipients = 0 then
    return;
  end if;

  insert into esla.telegram_sends (patient_id, kind, recipients)
  values (p_patient, p_kind, count_recipients);

  return query
    select t.chat_id from esla.telegram_subscribers t where t.patient_id = p_patient;
end;
$$;

-- Кто давно молчит.
--
-- last_seen_at = null пропускаем намеренно: такой телефон не молчит, он
-- ещё ни разу не выходил на связь, и тревожить по этому поводу нечего.
create or replace function esla.telegram_silent_patients(p_after interval)
returns table (patient_id uuid, patient_name text, last_seen_at timestamptz)
language sql
security definer
set search_path = esla, pg_temp
as $$
  select p.id, p.display_name, p.last_seen_at
    from esla.profiles p
   where p.role = 'patient'
     and p.last_seen_at is not null
     and p.last_seen_at < now() - p_after
     and exists (select 1 from esla.telegram_subscribers t where t.patient_id = p.id);
$$;

-- Нужны ли подробности в сообщении про этого пациента.
create or replace function esla.telegram_wants_details(p_patient uuid)
returns boolean
language sql
security definer
set search_path = esla, pg_temp
as $$
  select coalesce(p.telegram_details, true) from esla.profiles p where p.id = p_patient;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Права
-- ─────────────────────────────────────────────────────────────────────────

grant select, delete on esla.telegram_subscribers to authenticated;
grant select on esla.telegram_sends to authenticated;
grant usage, select on sequence esla.telegram_subscribers_id_seq to authenticated;
grant usage, select on sequence esla.telegram_sends_id_seq to authenticated;

grant execute on function esla.refresh_telegram_code() to authenticated;
grant execute on function esla.revoke_telegram_code() to authenticated;

-- Функции бота — только служебному ключу, который живёт на сервере.
revoke execute on function esla.link_telegram(text, bigint, text) from public;
revoke execute on function esla.unlink_telegram(bigint) from public;
revoke execute on function esla.telegram_claim_send(uuid, text, interval) from public;
revoke execute on function esla.telegram_silent_patients(interval) from public;
revoke execute on function esla.telegram_wants_details(uuid) from public;
grant execute on function esla.link_telegram(text, bigint, text) to service_role;
grant execute on function esla.unlink_telegram(bigint) to service_role;
grant execute on function esla.telegram_claim_send(uuid, text, interval) to service_role;
grant execute on function esla.telegram_silent_patients(interval) to service_role;
grant execute on function esla.telegram_wants_details(uuid) to service_role;
