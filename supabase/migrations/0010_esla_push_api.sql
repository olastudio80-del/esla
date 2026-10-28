-- Обёртки в public для функций, которыми пользуется сервер.
--
-- Права отзываем именно у anon и authenticated: «revoke from public» их не
-- снимает, потому что Supabase выдаёт их на каждую новую функцию в public
-- явно. Это уже один раз было пропущено, см. 0006.

create or replace function public.esla_notify_claim(
  p_patient uuid, p_kind text, p_cooldown_minutes integer
)
returns boolean
language sql
security invoker
set search_path = public, pg_temp
as $$
  select esla.notify_claim(p_patient, p_kind, make_interval(mins => p_cooldown_minutes));
$$;

create or replace function public.esla_telegram_chats(p_patient uuid)
returns table (chat bigint)
language sql
security invoker
set search_path = public, pg_temp
as $$ select * from esla.telegram_chats(p_patient); $$;

create or replace function public.esla_relative_push_tokens(p_patient uuid)
returns table (device_token text, device_platform text)
language sql
security invoker
set search_path = public, pg_temp
as $$ select * from esla.relative_push_tokens(p_patient); $$;

create or replace function public.esla_forget_push_device(p_token text)
returns integer
language sql
security invoker
set search_path = public, pg_temp
as $$ select esla.forget_push_device(p_token); $$;

revoke execute on function public.esla_notify_claim(uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function public.esla_telegram_chats(uuid)
  from public, anon, authenticated;
revoke execute on function public.esla_relative_push_tokens(uuid)
  from public, anon, authenticated;
revoke execute on function public.esla_forget_push_device(text)
  from public, anon, authenticated;

grant execute on function public.esla_notify_claim(uuid, text, integer) to service_role;
grant execute on function public.esla_telegram_chats(uuid) to service_role;
grant execute on function public.esla_relative_push_tokens(uuid) to service_role;
grant execute on function public.esla_forget_push_device(text) to service_role;
