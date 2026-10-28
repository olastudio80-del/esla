import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { listMedications, setNotificationId } from '@/db/medications';
import type { Meal, Medication } from '@/db/types';
import { translate } from '@/i18n';
import { addDays, atTime, dateKey, parseLocalISO } from '@/lib/date';
import type { Lang } from '@/store/prefs';

/**
 * Канал напоминаний. Важность MAX и вибрация здесь не ради громкости:
 * именно через системное уведомление телефона вибрирует фитнес-браслет —
 * приложение браслета (Mi Fitness, Zepp, Samsung Health) зеркалит
 * уведомления на устройство. Своего протокола к браслету нам не нужно.
 */
export const DOSE_CHANNEL = 'dose-reminders';

/**
 * iOS хранит не больше 64 отложенных локальных уведомлений, лишние молча
 * отбрасываются. Поэтому курсовые лекарства планируются по дням только
 * пока укладываемся в бюджет, а остальное — повторяющимся ежедневным
 * триггером (одно уведомление на одно время приёма).
 */
const PENDING_BUDGET = Platform.OS === 'ios' ? 56 : 400;

/** До какого горизонта расписываем курс по отдельным дням. */
const COURSE_HORIZON_DAYS = 14;

/**
 * Точная доставка вместо «по возможности».
 *
 * По умолчанию Android использует setExactAndAllowWhileIdle(), и прошивки
 * Xiaomi, Samsung, Huawei откладывают такие уведомления на минуты ради
 * экономии батареи. Для напоминания о лекарстве это недопустимо, поэтому
 * берём setAlarmClock() — его система не переносит. Документация
 * expo-notifications прямо называет напоминания о лекарствах случаем,
 * для которого этот режим и предназначен. Требует разрешения
 * USE_EXACT_ALARM, объявленного в app.json; без него Android молча
 * вернётся к обычному режиму, и приложение продолжит работать.
 */
const DELIVERY = 'alarmClock' as const;

/** Как приложение показывает уведомление, когда оно открыто. */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DOSE_CHANNEL, {
    name: 'Dori eslatmalari',
    importance: Notifications.AndroidImportance.MAX,
    // Заметный, но не дробный рисунок: пауза, длинный, пауза, длинный.
    vibrationPattern: [0, 400, 200, 400],
    enableVibrate: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function getPermissionGranted(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** Спрашивает разрешение. На Android 13+ без него уведомлений не будет вовсе. */
export async function requestPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  // canAskAgain === false означает отказ навсегда: дальше только настройки телефона.
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

function mealLabel(lang: Lang, meal: Meal): string | null {
  if (meal === 'after') return translate(lang, 'afterMeal');
  if (meal === 'before') return translate(lang, 'beforeMeal');
  return null;
}

function doseBody(lang: Lang, med: Medication): string {
  const dosage = med.dosage ?? '';
  const meal = mealLabel(lang, med.meal);
  return meal
    ? translate(lang, 'notifBodyWithMeal', { name: med.name, dosage, meal })
    : translate(lang, 'notifBody', { name: med.name, dosage });
}

/** Последний день курса, либо null для постоянного приёма. */
function courseEnd(med: Medication): string | null {
  if (med.course_days == null) return null;
  return addDays(med.started_on, med.course_days - 1);
}

export type ScheduleReport = {
  /** Сколько уведомлений поставлено в систему. */
  scheduled: number;
  /** Лекарства, у которых курс уже закончился — им уведомления не нужны. */
  finished: string[];
  /** true, если пришлось экономить бюджет отложенных уведомлений. */
  budgetReached: boolean;
};

/**
 * Пересобирает все напоминания с нуля.
 *
 * Вызывается при запуске приложения и после любой правки лекарств. Полная
 * пересборка вместо точечных правок выбрана сознательно: расписание короткое,
 * а рассинхрон между базой и системным планировщиком означал бы пропущенную
 * таблетку — цена ошибки выше экономии на пересчёте.
 */
export async function rescheduleAll(lang: Lang): Promise<ScheduleReport> {
  const report: ScheduleReport = { scheduled: 0, finished: [], budgetReached: false };

  if (!(await getPermissionGranted())) return report;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const meds = await listMedications();
  const today = dateKey();

  for (const med of meds) {
    if (med.times.length === 0) continue;

    const end = courseEnd(med);
    if (end && end < today) {
      report.finished.push(med.name);
      continue;
    }

    const title = translate(lang, 'notifTitle');
    const body = doseBody(lang, med);
    const data = { medicationId: med.id };

    for (const time of med.times) {
      const remaining = report.scheduled;
      const useDates =
        end !== null &&
        // Курс укладывается в горизонт — расписываем по дням, чтобы
        // напоминания сами прекратились в последний день курса.
        Math.max(0, daysLeft(today, end)) <= COURSE_HORIZON_DAYS &&
        remaining + daysLeft(today, end) + 1 <= PENDING_BUDGET;

      if (useDates) {
        const ids: string[] = [];
        for (let day = today; day <= end; day = addDays(day, 1)) {
          const when = parseLocalISO(atTime(day, time.hour, time.minute));
          if (when.getTime() <= Date.now()) continue; // прошедшее время не планируем
          const id = await Notifications.scheduleNotificationAsync({
            content: { title, body, data, sound: 'default' },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: when,
              channelId: DOSE_CHANNEL,
              delivery: DELIVERY,
            },
          });
          ids.push(id);
          report.scheduled++;
        }
        // Храним первый id: по нему видно, что расписание поставлено.
        await setNotificationId(time.id, ids[0] ?? null);
      } else {
        if (report.scheduled >= PENDING_BUDGET) {
          report.budgetReached = true;
          continue;
        }
        const id = await Notifications.scheduleNotificationAsync({
          content: { title, body, data, sound: 'default' },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: time.hour,
            minute: time.minute,
            channelId: DOSE_CHANNEL,
            delivery: DELIVERY,
          },
        });
        await setNotificationId(time.id, id);
        report.scheduled++;
      }
    }
  }

  return report;
}

function daysLeft(fromISO: string, toISO: string): number {
  return Math.round(
    (parseLocalISO(toISO).getTime() - parseLocalISO(fromISO).getTime()) / 86_400_000,
  );
}

/** Кнопка «напомнить через 10 минут»: разовое уведомление поверх расписания. */
export async function snoozeDose(
  lang: Lang,
  medicationName: string,
  dosage: string | null,
  minutes: number,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: translate(lang, 'notifTitle'),
      body: translate(lang, 'notifBody', { name: medicationName, dosage: dosage ?? '' }),
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, minutes * 60),
      channelId: DOSE_CHANNEL,
    },
  });
}

/**
 * Уведомление «вы забыли надеть браслет» — раз в день, не настойчиво.
 * Без браслета приложение работает полностью, поэтому это подсказка, а не тревога.
 */
export async function scheduleBraceletHint(lang: Lang, hour = 11, minute = 20): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: translate(lang, 'notifBraceletTitle'),
      body: translate(lang, 'notifBraceletBody'),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: DOSE_CHANNEL,
    },
  });
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Для экрана настроек: что сейчас реально стоит в системном планировщике. */
export async function listPending(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}
