-- Сообщение близким о неотмеченном приёме.
--
-- ЧТО МЫ НА САМОМ ДЕЛЕ ЗНАЕМ. Только то, что кнопку не нажали. Пожилой
-- человек часто выпивает таблетку и забывает отметить — это не то же самое,
-- что пропущенное лекарство. Поэтому текст сообщения говорит «не отметил
-- приём», а не «не принял»: близкий звонит и спрашивает, а не делает
-- выводов за него.
--
-- Окно намеренно узкое. Берём дозы старше льготного времени, но не старше
-- окна: иначе после каждой паузы в отправке всплывали бы вчерашние дозы.
-- Вместе с задержкой между сообщениями это даёт примерно одно сообщение на
-- пропуск, а не поток упрёков.
--
-- Работает это только потому, что план приёма уходит на сервер заранее —
-- см. PLAN_DAYS_AHEAD в src/features/cloud/sync.ts. Пока план уходил
-- вместе с отметкой приёма, сервер про неотмеченную дозу не знал вовсе.

alter table esla.telegram_sends
  drop constraint if exists telegram_sends_kind_check;
alter table esla.telegram_sends
  add constraint telegram_sends_kind_check
  check (kind in ('alarm', 'silence', 'missed', 'test'));

-- Имена выходных столбцов нарочно не совпадают с именами столбцов таблиц:
-- на совпадении уже один раз сломалась link_telegram.
create or replace function esla.telegram_missed_doses(p_grace interval, p_window interval)
returns table (
  missed_patient_id uuid,
  missed_patient_name text,
  missed_medicines text,
  missed_count integer
)
language sql
security definer
set search_path = esla, pg_temp
as $$
  select p.id,
         p.display_name,
         string_agg(distinct d.medication_name, ', ' order by d.medication_name),
         count(*)::int
    from esla.shared_doses d
    join esla.profiles p on p.id = d.patient_id
   where d.status in ('planned', 'missed')
     and d.planned_at < now() - p_grace
     and d.planned_at > now() - p_window
     and exists (select 1 from esla.telegram_subscribers t where t.patient_id = p.id)
   group by p.id, p.display_name;
$$;

revoke execute on function esla.telegram_missed_doses(interval, interval) from public;
grant execute on function esla.telegram_missed_doses(interval, interval) to service_role;

create or replace function public.esla_telegram_missed_doses(
  p_grace_minutes integer, p_window_minutes integer
)
returns table (patient_id uuid, patient_name text, medicines text, dose_count integer)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select * from esla.telegram_missed_doses(
    make_interval(mins => p_grace_minutes),
    make_interval(mins => p_window_minutes)
  );
$$;

revoke execute on function public.esla_telegram_missed_doses(integer, integer)
  from public, anon, authenticated;
grant execute on function public.esla_telegram_missed_doses(integer, integer) to service_role;
