import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/features/cloud/client';
import { ensureSession } from '@/features/cloud/sync';

/**
 * Push-уведомления близкому: своё уведомление на телефоне, а не в телеграме.
 *
 * Токен берём нативный (FCM на Android, APNs на iOS) и отправляем по нему
 * прямо из нашей функции на сервере. Служба push-уведомлений Expo не
 * участвует: ей потребовалась бы учётная запись Expo и загрузка туда наших
 * ключей Firebase, то есть ещё один посредник на пути к телефону.
 *
 * Это дополнение к телеграму, а не замена. Push живёт только пока
 * приложение установлено, и прошивки Xiaomi, Samsung, Huawei душат его
 * ради экономии батареи — те самые телефоны, что стоят у половины
 * Узбекистана. Телеграм этого не боится.
 */

/** Канал уведомлений о близком. Имя обязано совпасть с тем, что в функции. */
export const FAMILY_CHANNEL = 'family-alerts';

export type PushState =
  | 'ready'
  /** Человек не дал разрешения на уведомления. */
  | 'denied'
  /** Телефон не умеет: нет Firebase в сборке, эмулятор без сервисов Google. */
  | 'unavailable'
  /** Облако не настроено — отправлять некуда. */
  | 'cloud-off';

/**
 * Канал заводим отдельно от канала напоминаний о лекарствах: у них разный
 * смысл, и человек должен иметь возможность отключить одно, оставив
 * другое. Тревога о родителе — не то же самое, что «пора выпить таблетку».
 */
export async function configureFamilyChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(FAMILY_CHANNEL, {
    name: 'Yaqinlar haqida ogohlantirish',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    enableVibrate: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Зарегистрировать это устройство как получателя тревог.
 *
 * Вызывается у родственника: тревоги приходят ему, а не пациенту. Делать
 * это повторно безопасно — строка в базе привязана к токену, а не к
 * вызову.
 */
export async function registerPushDevice(): Promise<PushState> {
  if (!supabase) return 'cloud-off';

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    if (!permission.canAskAgain) return 'denied';
    const asked = await Notifications.requestPermissionsAsync();
    if (!asked.granted) return 'denied';
  }

  await configureFamilyChannel();

  let token: Notifications.DevicePushToken;
  try {
    token = await Notifications.getDevicePushTokenAsync();
  } catch (error) {
    // Без google-services.json в сборке и без сервисов Google на телефоне
    // токена не существует. Это не поломка приложения: телеграм работает.
    console.warn('[esla] токен устройства не получен', error);
    return 'unavailable';
  }

  const value = typeof token.data === 'string' ? token.data : null;
  if (!value) return 'unavailable';

  const userId = await ensureSession();
  if (!userId) return 'cloud-off';

  const { error } = await supabase.from('esla_push_devices').upsert(
    {
      user_id: userId,
      token: value,
      platform: token.type === 'ios' ? 'ios' : 'android',
      updated_at: new Date().toISOString(),
    },
    // Ключ — токен: одно устройство это одна строка, и переустановка
    // приложения даёт новый токен, а не второй для того же.
    { onConflict: 'token' },
  );

  if (error) {
    console.warn('[esla] устройство не зарегистрировано', error.message);
    return 'cloud-off';
  }
  return 'ready';
}

/** Перестать получать тревоги на это устройство. */
export async function forgetPushDevice(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    const value = typeof token.data === 'string' ? token.data : null;
    if (!value) return false;
    const { error } = await supabase.from('esla_push_devices').delete().eq('token', value);
    return !error;
  } catch {
    return false;
  }
}
