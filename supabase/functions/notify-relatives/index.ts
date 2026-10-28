import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { sendPush } from './fcm.ts';
import {
  alarmNotice,
  label,
  missedNotice,
  pushBody,
  silenceNotice,
  telegramText,
  testNotice,
  type Lang,
  type Notice,
} from './texts.ts';

/**
 * Сообщения близким: телеграм и push — из одного места.
 *
 * Три повода. Тревожный симптом: приложение само зовёт эту функцию сразу
 * после того, как человек его отметил. Неотмеченный приём лекарства и
 * долгое молчание телефона: их замечает не приложение, а расписание на
 * сервере — тот, кто перестал принимать лекарства, обычно перестаёт и
 * открывать приложение, а молчащий телефон по определению ничего о себе
 * не сообщит.
 *
 * ДВА КАНАЛА, ОДНО РЕШЕНИЕ. Push доходит только пока приложение
 * установлено и его не задушила экономия батареи; телеграм этого не
 * боится, но требует подписки. Поэтому событие уходит в оба, а решение
 * «отправлять или нет» принимается один раз в базе: иначе второй канал
 * получал бы отказ по задержке, которую поставил первый.
 *
 * ЧТО УХОДИТ НАРУЖУ. Имя, симптом и названия лекарств. Свободный рассказ
 * человека («note») не отправляется никогда: это его слова о себе, и для
 * решения «ехать или позвонить» они не нужны — близкий прочитает их в
 * приложении.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

/** Повторные тревоги в пределах окна не превращаются в поток сообщений. */
const ALARM_COOLDOWN_MINUTES = 15;
/** Молчание напоминает о себе не чаще раза в полсуток. */
const SILENCE_COOLDOWN_MINUTES = 12 * 60;
/** Сколько часов молчания считаем поводом потревожить близких. */
const SILENCE_AFTER_HOURS = 36;

/**
 * Сколько ждём после времени приёма, прежде чем сказать близким.
 *
 * Два часа — не формальность. Человек мог выпить таблетку и отложить
 * телефон, не нажав кнопку; за два часа он обычно до приложения
 * добирается. Меньше — и близкие получали бы ложные тревоги, а на третьей
 * такой они перестанут читать сообщения вовсе.
 */
const MISSED_GRACE_MINUTES = 120;
/** Старше этого дозы не вспоминаем: вчерашний пропуск уже не новость. */
const MISSED_WINDOW_MINUTES = 8 * 60;
/** Не чаще раза в шесть часов: это сообщение, а не упрёк. */
const MISSED_COOLDOWN_MINUTES = 6 * 60;

type Kind = 'alarm' | 'silence' | 'missed' | 'test';

const service = () => createClient(SUPABASE_URL, SERVICE_KEY);

async function sendTelegram(chatId: number, text: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (response.ok) return true;
  // Отписавшийся или заблокировавший бота — не повод считать отправку сбоем.
  console.warn('[esla] сообщение не доставлено', chatId, await response.text());
  return false;
}

/**
 * Разослать по всем каналам. Возвращает, сколько сообщений дошло.
 *
 * Отказ по задержке — это не ошибка: он означает, что близких уже
 * предупредили об этом же совсем недавно.
 */
async function fanOut(
  patientId: string,
  kind: Kind,
  cooldownMinutes: number,
  notice: Notice,
): Promise<number> {
  const db = service();

  const { data: claimed, error: claimError } = await db.rpc('esla_notify_claim', {
    p_patient: patientId,
    p_kind: kind,
    p_cooldown_minutes: cooldownMinutes,
  });
  if (claimError) {
    console.error('[esla] отметка об отправке не поставлена', claimError.message);
    return 0;
  }
  if (claimed !== true) return 0;

  const [chats, devices] = await Promise.all([
    db.rpc('esla_telegram_chats', { p_patient: patientId }),
    db.rpc('esla_relative_push_tokens', { p_patient: patientId }),
  ]);

  if (chats.error) console.error('[esla] переписки не получены', chats.error.message);
  if (devices.error) console.error('[esla] устройства не получены', devices.error.message);

  const text = telegramText(notice);
  const telegramSent = await Promise.all(
    ((chats.data ?? []) as { chat: number }[]).map((row) => sendTelegram(row.chat, text)),
  );

  const pushSent = await sendPush(
    ((devices.data ?? []) as { device_token: string }[]).map((row) => row.device_token),
    { title: notice.title, body: pushBody(notice), kind },
    async (token) => {
      await db.rpc('esla_forget_push_device', { p_token: token });
    },
  );

  return telegramSent.filter(Boolean).length + pushSent;
}

/** Тревога от приложения. Пациент — тот, чей токен в запросе. */
async function handleAlarm(req: Request): Promise<Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'no-token' }, 401);

  const db = service();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'bad-token' }, 401);

  const patientId = auth.user.id;
  const body = (await req.json().catch(() => ({}))) as {
    symptoms?: unknown;
    lang?: unknown;
    test?: unknown;
  };

  const { data: profile } = await db
    .from('esla_profiles')
    .select('display_name, telegram_details')
    .eq('id', patientId)
    .maybeSingle();

  // Подробности спрашиваем у базы, хотя приложение их и так не присылает
  // при выключенном переключателе: решение человека не должно зависеть от
  // того, какая версия приложения у него стоит.
  const details = profile?.telegram_details !== false;
  const symptoms =
    details && Array.isArray(body.symptoms)
      ? body.symptoms.filter((s): s is string => typeof s === 'string').slice(0, 5)
      : [];

  const lang: Lang = body.lang === 'ru' ? 'ru' : 'uz';
  const kind: Kind = body.test === true ? 'test' : 'alarm';
  const notice =
    kind === 'test' ? testNotice(lang) : alarmNotice(label(profile?.display_name ?? null), symptoms, lang);

  const sent = await fanOut(patientId, kind, kind === 'test' ? 0 : ALARM_COOLDOWN_MINUTES, notice);
  return json({ sent });
}

/**
 * Обход молчащих телефонов и неотмеченных доз. Вызывается расписанием
 * внутри базы.
 *
 * Авторизации нет намеренно. Посторонний вызов не даёт ничего: функция сама
 * выбирает, о ком писать, отправляет не чаще раза в оговорённое время на
 * человека и в ответе не раскрывает ни имён, ни сколько их. Единственное,
 * чего добился бы злоумышленник, — отправки, которая и так случилась бы
 * через несколько минут. Любой секрет здесь пришлось бы где-то хранить, и
 * место хранения стало бы уязвимее самой функции.
 */
async function handleSweep(): Promise<Response> {
  const silence = await sweepSilence();
  const missed = await sweepMissed();
  return json({ sent: silence + missed, silence, missed });
}

async function sweepSilence(): Promise<number> {
  const db = service();
  const { data, error } = await db.rpc('esla_notify_silent_patients', {
    p_after_hours: SILENCE_AFTER_HOURS,
  });
  if (error) {
    console.error('[esla] молчащие не получены', error.message);
    return 0;
  }

  let sent = 0;
  for (const row of (data ?? []) as { patient_id: string; patient_name: string | null }[]) {
    sent += await fanOut(
      row.patient_id,
      'silence',
      SILENCE_COOLDOWN_MINUTES,
      silenceNotice(label(row.patient_name), SILENCE_AFTER_HOURS),
    );
  }
  return sent;
}

/**
 * Неотмеченные дозы.
 *
 * Тоже работа сервера, а не приложения: человек, перестающий принимать
 * лекарства, обычно перестаёт и открывать приложение — именно поэтому план
 * приёма уходит наверх заранее, а не в момент отметки.
 */
async function sweepMissed(): Promise<number> {
  const db = service();
  const { data, error } = await db.rpc('esla_notify_missed_doses', {
    p_grace_minutes: MISSED_GRACE_MINUTES,
    p_window_minutes: MISSED_WINDOW_MINUTES,
  });
  if (error) {
    console.error('[esla] неотмеченные дозы не получены', error.message);
    return 0;
  }

  let sent = 0;
  for (const row of (data ?? []) as {
    patient_id: string;
    patient_name: string | null;
    medicines: string | null;
  }[]) {
    if (!row.medicines) continue;
    sent += await fanOut(
      row.patient_id,
      'missed',
      MISSED_COOLDOWN_MINUTES,
      missedNotice(label(row.patient_name), row.medicines),
    );
  }
  return sent;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const url = new URL(req.url);
  if (url.pathname.endsWith('/sweep')) return handleSweep();

  try {
    return await handleAlarm(req);
  } catch (error) {
    console.error('[esla] тревога не отправлена', error);
    return json({ error: 'failed' }, 500);
  }
});
