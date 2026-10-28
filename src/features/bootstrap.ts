import { getDb } from '@/db';
import { markOverdueAsMissed } from '@/db/doses';
import {
  configureAndroidChannel,
  configureNotificationHandler,
  rescheduleAll,
} from '@/features/notifications';
import type { Lang } from '@/store/prefs';

export type BootstrapResult = {
  /** Сколько доз только что отмечено пропущенными — для подсказки на главной. */
  missedNow: number;
  /** Сколько напоминаний стоит в системе. */
  scheduled: number;
};

/**
 * Запуск приложения. Порядок важен:
 *
 * 1. База — всё остальное читает из неё.
 * 2. Канал и обработчик уведомлений — до планирования.
 * 3. Просроченные дозы в «пропущено» — именно этот переход рождает
 *    уведомление родственнику.
 * 4. Пересборка расписания — система могла потерять уведомления после
 *    перезагрузки телефона, обновления приложения или смены часового пояса.
 *
 * Ошибка на любом шаге не должна мешать открыть приложение: человек пришёл
 * посмотреть, какое лекарство принимать, а не читать про сбой.
 */
export async function bootstrap(lang: Lang, missedAfterMinutes: number): Promise<BootstrapResult> {
  const result: BootstrapResult = { missedNow: 0, scheduled: 0 };

  try {
    await getDb();
  } catch (error) {
    console.warn('[esla] не удалось открыть базу', error);
    return result;
  }

  configureNotificationHandler();
  try {
    await configureAndroidChannel();
  } catch (error) {
    console.warn('[esla] канал уведомлений не создан', error);
  }

  try {
    const missed = await markOverdueAsMissed(missedAfterMinutes);
    result.missedNow = missed.length;
  } catch (error) {
    console.warn('[esla] не удалось пересчитать пропущенные дозы', error);
  }

  try {
    const report = await rescheduleAll(lang);
    result.scheduled = report.scheduled;
  } catch (error) {
    console.warn('[esla] не удалось пересобрать напоминания', error);
  }

  return result;
}
