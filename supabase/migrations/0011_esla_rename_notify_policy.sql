-- Политика осталась с прежним именем после переименования таблицы:
-- telegram_sends_select_own на esla.notify_sends читается как недосмотр,
-- а журнал теперь общий для двух каналов.
alter policy telegram_sends_select_own on esla.notify_sends
  rename to notify_sends_select_own;
