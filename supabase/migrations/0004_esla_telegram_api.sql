-- Доступ к телеграм-части через схему public.
--
-- Та же причина, что и в 0002: наружу смотрит только public, поэтому каждая
-- таблица и функция получает представление-обёртку. security_invoker и здесь
-- обязателен — без него обёртка читала бы данные правами владельца и любой
-- подписчик увидел бы подписчиков всех пациентов.

-- Профиль пополнился кодом подписки и выключателем подробностей.
-- Новые столбцы дописываются в конец: иначе replace представления откажет.
create or replace view public.esla_profiles with (security_invoker = true) as
  select id, display_name, role, invite_code, invite_expires_at, push_token,
         last_seen_at, created_at, updated_at,
         telegram_code, telegram_code_expires_at, telegram_details
    from esla.profiles;

create or replace view public.esla_telegram_subscribers with (security_invoker = true) as
  select id, patient_id, chat_id, title, created_at
    from esla.telegram_subscribers;

create or replace view public.esla_telegram_sends with (security_invoker = true) as
  select id, patient_id, kind, recipients, created_at
    from esla.telegram_sends;

-- ─────────────────────────────────────────────────────────────────────────
-- Для приложения
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.esla_refresh_telegram_code()
returns table (code text, expires_at timestamptz)
language sql
security invoker
set search_path = public, pg_temp
as $$ select * from esla.refresh_telegram_code(); $$;

create or replace function public.esla_revoke_telegram_code()
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$ select esla.revoke_telegram_code(); $$;

grant select, delete on public.esla_telegram_subscribers to authenticated;
grant select on public.esla_telegram_sends to authenticated;
grant execute on function public.esla_refresh_telegram_code() to authenticated;
grant execute on function public.esla_revoke_telegram_code() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Для бота
-- ─────────────────────────────────────────────────────────────────────────
--
-- Эти обёртки видны только служебному ключу, который живёт в секретах Edge
-- Functions и в приложение не попадает. Длительности принимаем числом, а не
-- интервалом: через JSON это надёжнее.

create or replace function public.esla_link_telegram(
  p_code text, p_chat bigint, p_title text
)
returns table (patient_id uuid, patient_name text)
language sql
security invoker
set search_path = public, pg_temp
as $$ select * from esla.link_telegram(p_code, p_chat, p_title); $$;

create or replace function public.esla_unlink_telegram(p_chat bigint)
returns integer
language sql
security invoker
set search_path = public, pg_temp
as $$ select esla.unlink_telegram(p_chat); $$;

create or replace function public.esla_telegram_claim_send(
  p_patient uuid, p_kind text, p_cooldown_minutes integer
)
returns table (chat_id bigint)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select * from esla.telegram_claim_send(
    p_patient, p_kind, make_interval(mins => p_cooldown_minutes)
  );
$$;

create or replace function public.esla_telegram_silent_patients(p_after_hours integer)
returns table (patient_id uuid, patient_name text, last_seen_at timestamptz)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select * from esla.telegram_silent_patients(make_interval(hours => p_after_hours));
$$;

create or replace function public.esla_telegram_wants_details(p_patient uuid)
returns boolean
language sql
security invoker
set search_path = public, pg_temp
as $$ select esla.telegram_wants_details(p_patient); $$;

revoke execute on function public.esla_link_telegram(text, bigint, text) from public;
revoke execute on function public.esla_unlink_telegram(bigint) from public;
revoke execute on function public.esla_telegram_claim_send(uuid, text, integer) from public;
revoke execute on function public.esla_telegram_silent_patients(integer) from public;
revoke execute on function public.esla_telegram_wants_details(uuid) from public;

grant execute on function public.esla_link_telegram(text, bigint, text) to service_role;
grant execute on function public.esla_unlink_telegram(bigint) to service_role;
grant execute on function public.esla_telegram_claim_send(uuid, text, integer) to service_role;
grant execute on function public.esla_telegram_silent_patients(integer) to service_role;
grant execute on function public.esla_telegram_wants_details(uuid) to service_role;
