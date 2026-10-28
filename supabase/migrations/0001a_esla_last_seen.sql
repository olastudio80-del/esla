-- Когда телефон родителя последний раз выходил на связь.
--
-- Основа лестницы реагирования: молчание само по себе сигнал. Проверять его
-- должен сервер, а не телефон: если человеку плохо, его приложение не
-- запустится и ничего никому не сообщит.

alter table esla.profiles
  add column if not exists last_seen_at timestamptz;

comment on column esla.profiles.last_seen_at is
  'Последняя отправка данных с телефона пациента. Долгое молчание — повод родственнику проверить.';

create or replace function esla.touch_last_seen()
returns void
language sql
security definer
set search_path = esla, pg_temp
as $$
  update esla.profiles
     set last_seen_at = now(), updated_at = now()
   where id = auth.uid();
$$;

grant execute on function esla.touch_last_seen() to authenticated;
