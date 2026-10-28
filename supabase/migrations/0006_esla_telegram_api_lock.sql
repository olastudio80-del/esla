-- Запереть обёртки бота по-настоящему.
--
-- «revoke execute from public» снимает только неявное право PUBLIC, а
-- Supabase выдаёт права на каждую новую функцию в схеме public ещё и явно —
-- через alter default privileges для anon, authenticated и service_role.
-- Поэтому обёртки из 0004 остались вызываемыми из приложения: вызов упирался
-- во внутреннюю функцию и падал с «permission denied», то есть данные не
-- утекали, но защита держалась на одном слое вместо двух.
--
-- Отсюда правило для всех будущих функций «только для сервера» в схеме
-- public: отзывать права именно у anon и authenticated, а не у public, и
-- проверять результат запросом has_function_privilege, а не на глаз.

revoke execute on function public.esla_link_telegram(text, bigint, text)
  from anon, authenticated;
revoke execute on function public.esla_unlink_telegram(bigint)
  from anon, authenticated;
revoke execute on function public.esla_telegram_claim_send(uuid, text, integer)
  from anon, authenticated;
revoke execute on function public.esla_telegram_silent_patients(integer)
  from anon, authenticated;
revoke execute on function public.esla_telegram_wants_details(uuid)
  from anon, authenticated;
