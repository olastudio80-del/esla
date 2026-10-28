-- Расписание обхода молчащих телефонов.
--
-- Проверять должен сервер, а не приложение: если человеку плохо, его
-- телефон ничего никому не сообщит — в этом и весь сигнал. Раз в час
-- достаточно, потому что сама отправка ограничена одним сообщением в
-- полсуток на человека.
--
-- Минута не нулевая намеренно: на нулевой минуте запускается половина
-- расписаний мира, и очередь задерживает запуск.
--
-- pg_net ставим в схему extensions, а не в public: расширение в public —
-- замечание линтера безопасности Supabase. Функции самого pg_net всё равно
-- живут в схеме net, поэтому вызов ниже от этого не меняется.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Пересоздаём на случай повторного применения: расписание с тем же именем
-- иначе задвоилось бы.
select cron.unschedule('esla-silence-sweep')
 where exists (select 1 from cron.job where jobname = 'esla-silence-sweep');

select cron.schedule(
  'esla-silence-sweep',
  '17 * * * *',
  $$
    select net.http_post(
      url := 'https://rjakxtcpumdqjqzufskh.supabase.co/functions/v1/notify-relatives/sweep',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
