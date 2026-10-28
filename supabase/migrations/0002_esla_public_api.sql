-- Доступ к данным esla через схему public.
--
-- Схема public открыта для API всегда, а открытие собственной схемы требует
-- настройки в панели Supabase, которую нельзя проверить из среды разработки.
-- Поэтому таблицы остаются в esla, а наружу смотрят представления с префиксом.
--
-- security_invoker = true здесь обязателен. Без него представление читало бы
-- данные правами владельца и обошло бы разграничение доступа целиком —
-- любой родственник увидел бы медицинские данные всех пациентов сразу.

create or replace view public.esla_profiles with (security_invoker = true) as
  select id, display_name, role, invite_code, invite_expires_at, push_token,
         last_seen_at, created_at, updated_at
    from esla.profiles;

create or replace view public.esla_links with (security_invoker = true) as
  select id, patient_id, relative_id, relation, created_at
    from esla.links;

create or replace view public.esla_shared_doses with (security_invoker = true) as
  select id, patient_id, local_id, medication_name, dosage, planned_at,
         status, acted_at, updated_at
    from esla.shared_doses;

create or replace view public.esla_shared_vitals with (security_invoker = true) as
  select patient_id, heart_rate, heart_rate_at, steps, steps_at,
         sleep_minutes, sleep_at, updated_at
    from esla.shared_vitals;

create or replace view public.esla_shared_alarms with (security_invoker = true) as
  select id, patient_id, local_id, symptoms, note, created_at, seen_at
    from esla.shared_alarms;

-- Функции тоже должны быть видны из public, иначе их не вызвать из приложения.
create or replace function public.esla_refresh_invite_code()
returns table (code text, expires_at timestamptz)
language sql
security invoker
set search_path = public, pg_temp
as $$ select * from esla.refresh_invite_code(); $$;

create or replace function public.esla_claim_invite(code text, relation text default null)
returns uuid
language sql
security invoker
set search_path = public, pg_temp
as $$ select esla.claim_invite(code, relation); $$;

create or replace function public.esla_touch_last_seen()
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$ select esla.touch_last_seen(); $$;

grant select, insert, update, delete on
  public.esla_profiles, public.esla_links, public.esla_shared_doses,
  public.esla_shared_vitals, public.esla_shared_alarms
  to authenticated;

grant execute on function public.esla_refresh_invite_code() to authenticated;
grant execute on function public.esla_claim_invite(text, text) to authenticated;
grant execute on function public.esla_touch_last_seen() to authenticated;
