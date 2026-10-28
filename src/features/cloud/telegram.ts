import { supabase } from './client';
import { ensureSession } from './sync';

import { symptomById } from '@/data/symptoms';
import type { Lang } from '@/store/prefs';

/**
 * Уведомления близким через телеграм.
 *
 * Почему телеграм, а не push: обычные уведомления требуют Firebase или
 * учётной записи Expo, а для iPhone ещё и платного аккаунта Apple.
 * Родственнику же не нужно ставить приложение вовсе — он открывает ссылку
 * и нажимает «Start».
 *
 * Токена бота здесь нет и быть не может: всё, что связано с телеграмом,
 * происходит на сервере. Приложение только говорит «случилась тревога»
 * своим же токеном входа, а кому писать — решает сервер.
 */

export type TelegramSubscriber = {
  id: number;
  chatId: number;
  /** Имя из телеграма: по нему человек узнаёт, кто подписан. */
  title: string | null;
  createdAt: string;
};

export type TelegramLink = {
  code: string;
  expiresAt: string;
  /** Готовая ссылка для близкого. null, если бот ещё не настроен. */
  url: string | null;
};

/**
 * Имя бота спрашиваем у сервера и запоминаем на время запуска.
 *
 * Прописать его в настройках приложения было бы проще, но тогда смена бота
 * требовала бы пересборки APK у всех, у кого он уже установлен.
 */
let botUsername: string | null | undefined;

async function fetchBotUsername(): Promise<string | null> {
  if (botUsername !== undefined) return botUsername;
  if (!supabase) return null;

  try {
    const { data } = await supabase.functions.invoke<{ username: string | null }>(
      'telegram-bot/info',
      { method: 'GET' },
    );
    botUsername = data?.username ?? null;
  } catch (error) {
    console.warn('[esla] имя бота не получено', error);
    botUsername = null;
  }
  return botUsername;
}

/** Новый код подписки и ссылка, которую можно переслать близкому. */
export async function refreshTelegramLink(): Promise<TelegramLink | null> {
  if (!supabase) return null;
  if (!(await ensureSession())) return null;

  const { data, error } = await supabase.rpc('esla_refresh_telegram_code');
  if (error || !data?.[0]) {
    console.warn('[esla] код подписки не выдан', error?.message);
    return null;
  }

  const code = data[0].code as string;
  const username = await fetchBotUsername();
  return {
    code,
    expiresAt: data[0].expires_at as string,
    url: username ? `https://t.me/${username}?start=${code}` : null,
  };
}

/** Погасить код досрочно. Уже подписанные остаются подписанными. */
export async function revokeTelegramLink(): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('esla_revoke_telegram_code');
  return !error;
}

export async function listSubscribers(): Promise<TelegramSubscriber[]> {
  if (!supabase) return [];
  const userId = await ensureSession();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('esla_telegram_subscribers')
    .select('id, chat_id, title, created_at')
    .eq('patient_id', userId)
    .order('created_at');

  if (error) {
    console.warn('[esla] подписчики не получены', error.message);
    return [];
  }
  return data.map((row) => ({
    id: row.id as number,
    chatId: row.chat_id as number,
    title: row.title as string | null,
    createdAt: row.created_at as string,
  }));
}

export async function removeSubscriber(id: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('esla_telegram_subscribers').delete().eq('id', id);
  return !error;
}

/** Писать ли в сообщении сам симптом. */
export async function getTelegramDetails(): Promise<boolean> {
  if (!supabase) return true;
  const userId = await ensureSession();
  if (!userId) return true;

  const { data } = await supabase
    .from('esla_profiles')
    .select('telegram_details')
    .eq('id', userId)
    .maybeSingle();

  // Молчание базы трактуем как «подробности нужны»: предупреждение без
  // причины бесполезно, а человек своего выбора ещё не делал.
  return data?.telegram_details !== false;
}

export async function setTelegramDetails(on: boolean): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSession();
  if (!userId) return false;

  const { error } = await supabase
    .from('esla_profiles')
    .update({ telegram_details: on, updated_at: new Date().toISOString() })
    .eq('id', userId);
  return !error;
}

/**
 * Разослать тревогу близким. Возвращает число доставленных сообщений,
 * либо null, если отправить не удалось вовсе.
 *
 * Симптомы передаём уже словами, а не кодами: словарь живёт в приложении,
 * и дублировать его на сервере значило бы расходиться с ним при каждой
 * правке. Свободный рассказ человека не отправляется — ни здесь, ни там.
 */
export async function notifyRelatives(options: {
  symptoms: string[];
  lang: Lang;
  /** Проверка связи: доходит ли сообщение. */
  test?: boolean;
}): Promise<number | null> {
  if (!supabase) return null;
  if (!(await ensureSession())) return null;

  const labels = options.symptoms
    .map((id) => symptomById(id))
    .filter((symptom): symptom is NonNullable<typeof symptom> => Boolean(symptom))
    .map((symptom) => (options.lang === 'ru' ? symptom.ru : symptom.uz));

  try {
    const { data, error } = await supabase.functions.invoke<{ sent: number }>('notify-relatives', {
      body: { symptoms: labels, lang: options.lang, test: options.test === true },
    });
    if (error) {
      console.warn('[esla] тревога не отправлена', error.message);
      return null;
    }
    return data?.sent ?? 0;
  } catch (error) {
    console.warn('[esla] тревога не отправлена', error);
    return null;
  }
}
