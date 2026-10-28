-- Исправление link_telegram: имена выходных столбцов перекрывали столбцы таблицы.
--
-- «returns table (patient_id …)» объявляет переменную patient_id, и в
-- «on conflict (patient_id, chat_id)» PostgreSQL не мог решить, столбец это
-- или переменная. Подписка падала бы у каждого близкого — поймано тестом,
-- который прогоняет настоящую подписку, а не просто проверяет права.
--
-- Выходные столбцы названы иначе; обёртка public.esla_link_telegram
-- отдаёт их боту под прежними именами, потому что сопоставление там по
-- порядку, а не по имени. Смена имён выходных столбцов меняет тип
-- результата, поэтому функции пересоздаются, а не заменяются.

drop function if exists public.esla_link_telegram(text, bigint, text);
drop function if exists esla.link_telegram(text, bigint, text);

create function esla.link_telegram(p_code text, p_chat bigint, p_title text)
returns table (linked_id uuid, linked_name text)
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

revoke execute on function esla.link_telegram(text, bigint, text) from public;
grant execute on function esla.link_telegram(text, bigint, text) to service_role;

create function public.esla_link_telegram(p_code text, p_chat bigint, p_title text)
returns table (patient_id uuid, patient_name text)
language sql
security invoker
set search_path = public, pg_temp
as $$ select * from esla.link_telegram(p_code, p_chat, p_title); $$;

revoke execute on function public.esla_link_telegram(text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.esla_link_telegram(text, bigint, text) to service_role;
