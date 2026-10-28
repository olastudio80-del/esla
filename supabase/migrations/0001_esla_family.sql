-- Раздел «Ota-onam»: родственник видит приём лекарств и самочувствие родителя.
--
-- ЧТО СЮДА ПОПАДАЕТ. Только то, что нужно увидеть на экране ребёнка:
-- названия лекарств с временем приёма, последние показатели браслета и
-- тревожные записи самочувствия. Анализы, заключения, диагнозы, аллергии,
-- переписка с помощником и обычные записи самочувствия остаются на телефоне
-- и наружу не уходят.
--
-- КТО КОГО ВИДИТ. Связь создаётся только по коду приглашения, который
-- родитель показывает на своём экране. Родственник не может найти пациента
-- иначе: таблица профилей закрыта, а связь заводит функция с проверкой кода.

create schema if not exists esla;

-- ─────────────────────────────────────────────────────────────────────────
-- Профили
-- ─────────────────────────────────────────────────────────────────────────

create table esla.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role        text not null default 'patient' check (role in ('patient', 'relative')),
  -- Код приглашения: короткий, его диктуют вслух. Живёт ограниченное время.
  invite_code text unique,
  invite_expires_at timestamptz,
  -- Токен для отправки уведомлений этому устройству.
  push_token  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_invite_code_idx on esla.profiles (invite_code)
  where invite_code is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- Связи «родитель — ребёнок»
-- ─────────────────────────────────────────────────────────────────────────

create table esla.links (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references esla.profiles(id) on delete cascade,
  relative_id uuid not null references esla.profiles(id) on delete cascade,
  -- Как родственник подписал родителя у себя: «Dadam», «Onam».
  relation    text,
  created_at  timestamptz not null default now(),
  unique (patient_id, relative_id),
  constraint links_not_self check (patient_id <> relative_id)
);

create index links_relative_idx on esla.links (relative_id);
create index links_patient_idx  on esla.links (patient_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Что пациент показывает родственнику
-- ─────────────────────────────────────────────────────────────────────────

create table esla.shared_doses (
  id              bigserial primary key,
  patient_id      uuid not null references esla.profiles(id) on delete cascade,
  -- Идентификатор дозы в базе на телефоне: по нему обновляем, а не плодим копии.
  local_id        bigint not null,
  medication_name text not null,
  dosage          text,
  planned_at      timestamptz not null,
  status          text not null check (status in ('planned', 'taken', 'missed', 'skipped')),
  acted_at        timestamptz,
  updated_at      timestamptz not null default now(),
  unique (patient_id, local_id)
);

create index shared_doses_patient_time_idx on esla.shared_doses (patient_id, planned_at desc);

-- Последние показатели браслета: одна строка на пациента, перезаписывается.
create table esla.shared_vitals (
  patient_id     uuid primary key references esla.profiles(id) on delete cascade,
  heart_rate     numeric,
  heart_rate_at  timestamptz,
  steps          integer,
  steps_at       timestamptz,
  sleep_minutes  integer,
  sleep_at       timestamptz,
  updated_at     timestamptz not null default now()
);

-- Тревожные записи самочувствия — те, при которых помощник направил к врачу.
create table esla.shared_alarms (
  id         bigserial primary key,
  patient_id uuid not null references esla.profiles(id) on delete cascade,
  local_id   bigint not null,
  symptoms   text[] not null default '{}',
  note       text,
  created_at timestamptz not null,
  seen_at    timestamptz,
  unique (patient_id, local_id)
);

create index shared_alarms_patient_idx on esla.shared_alarms (patient_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- Разграничение доступа
-- ─────────────────────────────────────────────────────────────────────────

alter table esla.profiles      enable row level security;
alter table esla.links         enable row level security;
alter table esla.shared_doses  enable row level security;
alter table esla.shared_vitals enable row level security;
alter table esla.shared_alarms enable row level security;

-- Помощник: связан ли текущий пользователь с этим пациентом.
-- SECURITY DEFINER, чтобы политики на links не вызывали сами себя.
create or replace function esla.is_relative_of(target uuid)
returns boolean
language sql
stable
security definer
set search_path = esla, pg_temp
as $$
  select exists (
    select 1 from esla.links
     where patient_id = target
       and relative_id = auth.uid()
  );
$$;

-- Профиль: свой — целиком; чужой — только если он твой родитель, и только имя.
create policy profiles_select_own on esla.profiles
  for select using (id = auth.uid() or esla.is_relative_of(id));

create policy profiles_insert_own on esla.profiles
  for insert with check (id = auth.uid());

create policy profiles_update_own on esla.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Связи видит и может разорвать каждая из сторон.
create policy links_select_own on esla.links
  for select using (patient_id = auth.uid() or relative_id = auth.uid());

create policy links_delete_own on esla.links
  for delete using (patient_id = auth.uid() or relative_id = auth.uid());
-- Создаётся только функцией claim_invite: прямой вставки нет намеренно,
-- иначе можно было бы привязаться к чужому пациенту, зная его id.

-- Данные: пишет только сам пациент, читает он и его родственники.
create policy doses_write_own on esla.shared_doses
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy doses_select_relative on esla.shared_doses
  for select using (esla.is_relative_of(patient_id));

create policy vitals_write_own on esla.shared_vitals
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy vitals_select_relative on esla.shared_vitals
  for select using (esla.is_relative_of(patient_id));

create policy alarms_write_own on esla.shared_alarms
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy alarms_select_relative on esla.shared_alarms
  for select using (esla.is_relative_of(patient_id));

-- Родственник отмечает, что увидел тревогу.
create policy alarms_update_relative on esla.shared_alarms
  for update using (esla.is_relative_of(patient_id))
  with check (esla.is_relative_of(patient_id));

-- ─────────────────────────────────────────────────────────────────────────
-- Код приглашения
-- ─────────────────────────────────────────────────────────────────────────

-- Алфавит без похожих знаков: ноль и «O», единица и «I» неразличимы на слух
-- и в чтении, а код диктует пожилой человек по телефону.
create or replace function esla.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Выдать пациенту новый код. Старый перестаёт работать сразу.
create or replace function esla.refresh_invite_code()
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
    exit when not exists (select 1 from esla.profiles p where p.invite_code = new_code);
    if attempts > 20 then
      raise exception 'invite_code_generation_failed';
    end if;
  end loop;

  update esla.profiles
     set invite_code = new_code,
         -- Сутки: за это время ребёнок успеет ввести код, а потом он мёртв.
         invite_expires_at = now() + interval '24 hours',
         updated_at = now()
   where id = auth.uid()
  returning invite_code, invite_expires_at into code, expires_at;

  if code is null then
    raise exception 'profile_not_found';
  end if;

  return next;
end;
$$;

-- Привязаться к пациенту по коду. Единственный способ создать связь.
create or replace function esla.claim_invite(code text, relation text default null)
returns uuid
language plpgsql
security definer
set search_path = esla, pg_temp
as $$
declare
  target uuid;
begin
  select p.id into target
    from esla.profiles p
   where p.invite_code = upper(trim(code))
     and p.invite_expires_at > now()
     and p.role = 'patient';

  if target is null then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;

  if target = auth.uid() then
    raise exception 'cannot_link_self' using errcode = 'P0001';
  end if;

  insert into esla.links (patient_id, relative_id, relation)
  values (target, auth.uid(), relation)
  on conflict (patient_id, relative_id) do nothing;

  -- Код одноразовый: после привязки он гаснет, чтобы подслушавший не вошёл.
  update esla.profiles
     set invite_code = null, invite_expires_at = null, updated_at = now()
   where id = target;

  return target;
end;
$$;

grant usage on schema esla to authenticated;
grant select, insert, update, delete on all tables in schema esla to authenticated;
grant usage, select on all sequences in schema esla to authenticated;
grant execute on function esla.refresh_invite_code() to authenticated;
grant execute on function esla.claim_invite(text, text) to authenticated;
