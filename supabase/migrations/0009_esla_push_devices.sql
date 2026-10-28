-- Push-уведомления близким: своё уведомление на телефоне, а не в телеграме.
--
-- ПОЧЕМУ ВМЕСТЕ С ТЕЛЕГРАМОМ, А НЕ ВМЕСТО. Push доходит только пока
-- приложение установлено, а прошивки Xiaomi, Samsung и Huawei — те самые,
-- что стоят у половины Узбекистана, — душат фоновую доставку ради батареи.
-- Телеграм этого не боится, и у него свой канал доставки. Поэтому одно
-- событие уходит сразу в оба, а решение «отправлять или нет» принимается
-- один раз в одном месте.
--
-- КОМУ УХОДИТ PUSH. Родственникам, связанным с пациентом кодом приглашения
-- (esla.links), а не подписчикам бота: это разные списки. Близкий без
-- приложения остаётся в телеграме, близкий с приложением получает оба.

create table if not exists esla.push_devices (
  id         bigserial primary key,
  user_id    uuid not null references esla.profiles(id) on delete cascade,
  -- Токен FCM или APNs. Он меняется при переустановке и чистке данных,
  -- поэтому уникален сам по себе: одно устройство — одна строка.
  token      text not null unique,
  platform   text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_devices_user_idx on esla.push_devices (user_id);

alter table esla.push_devices enable row level security;

drop policy if exists push_devices_own on esla.push_devices;
create policy push_devices_own on esla.push_devices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on esla.push_devices to authenticated;
grant usage, select on sequence esla.push_devices_id_seq to authenticated;

-- profiles.push_token был заведён под один токен на человека и ни разу не
-- использован: токенов бывает несколько, и они меняются. Убираем, чтобы в
-- схеме не осталось поля, которое выглядит рабочим, но ничего не значит.
drop view if exists public.esla_profiles;

alter table esla.profiles drop column if exists push_token;

create view public.esla_profiles with (security_invoker = true) as
  select id, display_name, role, invite_code, invite_expires_at,
         last_seen_at, created_at, updated_at,
         telegram_code, telegram_code_expires_at, telegram_details
    from esla.profiles;

grant select, insert, update, delete on public.esla_profiles to authenticated;

create or replace view public.esla_push_devices with (security_invoker = true) as
  select id, user_id, token, platform, created_at, updated_at
    from esla.push_devices;

grant select, insert, update, delete on public.esla_push_devices to authenticated;

-- Журнал отправок теперь общий для двух каналов.
alter table if exists esla.telegram_sends rename to notify_sends;
alter sequence if exists esla.telegram_sends_id_seq rename to notify_sends_id_seq;

drop view if exists public.esla_telegram_sends;

create or replace view public.esla_notify_sends with (security_invoker = true) as
  select id, patient_id, kind, recipients, created_at
    from esla.notify_sends;

grant select on public.esla_notify_sends to authenticated;

-- Раньше это была одна функция telegram_claim_send: она и решала, и
-- отдавала получателей. С двумя каналами так нельзя — второй канал
-- получил бы отказ по задержке, которую поставил первый. Теперь решение
-- принимается один раз, а получателей каждый канал берёт себе сам.
create or replace function esla.notify_claim(
  p_patient uuid,
  p_kind text,
  p_cooldown interval
)
returns boolean
language plpgsql
security definer
set search_path = esla, pg_temp
as $$
declare
  count_recipients integer;
begin
  if exists (
    select 1 from esla.notify_sends s
     where s.patient_id = p_patient
       and s.kind = p_kind
       and s.created_at > now() - p_cooldown
  ) then
    return false;
  end if;

  select
    (select count(*) from esla.telegram_subscribers t where t.patient_id = p_patient) +
    (select count(*) from esla.links l
       join esla.push_devices d on d.user_id = l.relative_id
      where l.patient_id = p_patient)
  into count_recipients;

  -- Без получателей отметку не ставим: иначе первый же пустой вызов
  -- заблокировал бы настоящую отправку на всё время задержки.
  if count_recipients = 0 then
    return false;
  end if;

  insert into esla.notify_sends (patient_id, kind, recipients)
  values (p_patient, p_kind, count_recipients);

  return true;
end;
$$;

create or replace function esla.telegram_chats(p_patient uuid)
returns table (chat bigint)
language sql
security definer
set search_path = esla, pg_temp
as $$
  select t.chat_id from esla.telegram_subscribers t where t.patient_id = p_patient;
$$;

create or replace function esla.relative_push_tokens(p_patient uuid)
returns table (device_token text, device_platform text)
language sql
security definer
set search_path = esla, pg_temp
as $$
  select d.token, d.platform
    from esla.links l
    join esla.push_devices d on d.user_id = l.relative_id
   where l.patient_id = p_patient;
$$;

-- Устройство, про которое Firebase сказал «такого нет»: переустановили
-- приложение или почистили данные. Держать такой токен значит писать в
-- пустоту при каждой тревоге.
create or replace function esla.forget_push_device(p_token text)
returns integer
language plpgsql
security definer
set search_path = esla, pg_temp
as $$
declare
  removed integer;
begin
  delete from esla.push_devices where token = p_token;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

drop function if exists public.esla_telegram_claim_send(uuid, text, integer);
drop function if exists esla.telegram_claim_send(uuid, text, interval);

revoke execute on function esla.notify_claim(uuid, text, interval) from public;
revoke execute on function esla.telegram_chats(uuid) from public;
revoke execute on function esla.relative_push_tokens(uuid) from public;
revoke execute on function esla.forget_push_device(text) from public;
grant execute on function esla.notify_claim(uuid, text, interval) to service_role;
grant execute on function esla.telegram_chats(uuid) to service_role;
grant execute on function esla.relative_push_tokens(uuid) to service_role;
grant execute on function esla.forget_push_device(text) to service_role;
