-- Обход расписания искал получателей только в телеграме.
--
-- Условие «есть кому отправлять» было написано, когда канал был один, и
-- при добавлении push его не поправили. Следствие: семья, у которой есть
-- приложение, но нет телеграма, не получила бы ни сообщения о долгом
-- молчании телефона, ни о неотмеченном приёме — то есть обе серверные
-- тревоги молчали бы, а по виду всё работало. Поймано проверкой отправки
-- на заведомо неверный токен: обход отобрал ноль человек при живом
-- получателе.
--
-- Теперь вопрос «есть ли получатели» задаётся в одном месте и знает про
-- оба канала. Имена функций заодно перестали врать: они не про телеграм.

create or replace function esla.has_notify_recipients(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = esla, pg_temp
as $$
  select
    exists (select 1 from esla.telegram_subscribers t where t.patient_id = p_patient)
    or exists (
      select 1 from esla.links l
        join esla.push_devices d on d.user_id = l.relative_id
       where l.patient_id = p_patient
    );
$$;

drop function if exists public.esla_telegram_silent_patients(integer);
drop function if exists esla.telegram_silent_patients(interval);
drop function if exists public.esla_telegram_missed_doses(integer, integer);
drop function if exists esla.telegram_missed_doses(interval, interval);

create function esla.notify_silent_patients(p_after interval)
returns table (silent_patient_id uuid, silent_patient_name text, silent_since timestamptz)
language sql
security definer
set search_path = esla, pg_temp
as $$
  select p.id, p.display_name, p.last_seen_at
    from esla.profiles p
   where p.role = 'patient'
     and p.last_seen_at is not null
     and p.last_seen_at < now() - p_after
     and esla.has_notify_recipients(p.id);
$$;

create function esla.notify_missed_doses(p_grace interval, p_window interval)
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
     and esla.has_notify_recipients(p.id)
   group by p.id, p.display_name;
$$;

create function public.esla_notify_silent_patients(p_after_hours integer)
returns table (patient_id uuid, patient_name text, last_seen_at timestamptz)
language sql
security invoker
set search_path = public, pg_temp
as $$ select * from esla.notify_silent_patients(make_interval(hours => p_after_hours)); $$;

create function public.esla_notify_missed_doses(
  p_grace_minutes integer, p_window_minutes integer
)
returns table (patient_id uuid, patient_name text, medicines text, dose_count integer)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select * from esla.notify_missed_doses(
    make_interval(mins => p_grace_minutes),
    make_interval(mins => p_window_minutes)
  );
$$;

revoke execute on function esla.has_notify_recipients(uuid) from public;
revoke execute on function esla.notify_silent_patients(interval) from public;
revoke execute on function esla.notify_missed_doses(interval, interval) from public;
revoke execute on function public.esla_notify_silent_patients(integer)
  from public, anon, authenticated;
revoke execute on function public.esla_notify_missed_doses(integer, integer)
  from public, anon, authenticated;

grant execute on function esla.has_notify_recipients(uuid) to service_role;
grant execute on function esla.notify_silent_patients(interval) to service_role;
grant execute on function esla.notify_missed_doses(interval, interval) to service_role;
grant execute on function public.esla_notify_silent_patients(integer) to service_role;
grant execute on function public.esla_notify_missed_doses(integer, integer) to service_role;
