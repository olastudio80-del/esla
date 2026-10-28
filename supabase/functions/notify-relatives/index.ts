import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Отправка тревог близким в телеграм.
 *
 * Три повода. Тревожный симптом: приложение само зовёт эту функцию сразу
 * после того, как человек его отметил. Неотмеченный приём лекарства и
 * долгое молчание телефона: их замечает не приложение, а расписание на
 * сервере — тот, кто перестал принимать лекарства, обычно перестаёт и
 * открывать приложение, а молчащий телефон по определению ничего о себе
 * не сообщит.
 *
 * ЧТО УХОДИТ НАРУЖУ. Имя, симптом и названия лекарств. Свободный рассказ
 * человека («note») не отправляется никогда: это его слова о себе, и для
 * решения «ехать или позвонить» они не нужны — близкий прочитает их в
 * приложении.
 */

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
/** Сколько букв списка лекарств влезает в сообщение. */
const MEDICINES_LIMIT = 100;

type Lang = 'uz' | 'ru';

const service = () => createClient(SUPABASE_URL, SERVICE_KEY);

async function send(chatId: number, text: string): Promise<boolean> {
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

function alarmText(name: string, symptoms: string[], lang: Lang): string {
  const what = symptoms.filter((s) => s.trim()).join(', ');
  if (lang === 'ru') {
    return [
      '🚨 esla',
      what ? `${name}: ${what}.` : `${name} нужно проверить.`,
      'Пожалуйста, свяжитесь с ним.',
    ].join('\n');
  }
  return [
    '🚨 esla',
    what ? `${name}: ${what}.` : `${name} bilan tekshirish kerak.`,
    'Iltimos, u bilan bogʻlaning.',
  ].join('\n');
}

/** Про молчание пишем на двух языках: приложение в этом не участвует. */
function silenceText(name: string, hours: number): string {
  return [
    '⏳ esla',
    `${name}: telefon ${hours} soatdan beri javob bermayapti.`,
    'Iltimos, qoʻngʻiroq qiling.',
    '',
    `${name}: телефон не выходит на связь ${hours} часов.`,
    'Пожалуйста, позвоните.',
  ].join('\n');
}

/**
 * Неотмеченный приём.
 *
 * Формулировка важнее механики: мы знаем только то, что кнопку не нажали,
 * и сообщение обязано говорить именно это. «Не принял лекарство» было бы
 * обвинением, которого мы проверить не можем, и оно же било бы по
 * отношениям в семье, ради которых всё это и делается.
 */
function missedText(name: string, medicines: string): string {
  const what =
    medicines.length > MEDICINES_LIMIT ? `${medicines.slice(0, MEDICINES_LIMIT)}…` : medicines;
  return [
    '💊 esla',
    `${name}: ${what} qabulini belgilamadi.`,
    'Dorini ichgan boʻlishi ham mumkin — iltimos, qoʻngʻiroq qilib soʻrang.',
    '',
    `${name}: не отметил приём — ${what}.`,
    'Возможно, лекарство принято, а кнопка не нажата — позвоните и спросите.',
  ].join('\n');
}

function label(name: string | null): string {
  return name && name.trim() ? name.trim() : 'Yaqiningiz / ваш близкий';
}

/** Разослать всем подписчикам пациента. Возвращает число доставленных. */
async function fanOut(
  patientId: string,
  kind: 'alarm' | 'silence' | 'missed' | 'test',
  cooldownMinutes: number,
  text: string,
): Promise<number> {
  const db = service();
  // Список получателей и отметка об отправке — одной операцией в базе:
  // иначе две одновременные тревоги отправили бы по сообщению каждая.
  const { data, error } = await db.rpc('esla_telegram_claim_send', {
    p_patient: patientId,
    p_kind: kind,
    p_cooldown_minutes: cooldownMinutes,
  });
  if (error) {
    console.error('[esla] получатели не получены', error.message);
    return 0;
  }

  const chats = (data ?? []).map((row: { chat_id: number }) => row.chat_id);
  const results = await Promise.all(chats.map((chat: number) => send(chat, text)));
  return results.filter(Boolean).length;
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
  const kind = body.test === true ? 'test' : 'alarm';
  const text =
    kind === 'test'
      ? [
          '✅ esla',
          lang === 'ru'
            ? 'Проверка связи. Так будет выглядеть предупреждение.'
            : 'Aloqa tekshiruvi. Ogohlantirish shunday koʻrinadi.',
        ].join('\n')
      : alarmText(label(profile?.display_name ?? null), symptoms, lang);

  const sent = await fanOut(patientId, kind, kind === 'test' ? 0 : ALARM_COOLDOWN_MINUTES, text);
  return json({ sent });
}

/**
 * Обход молчащих телефонов. Вызывается расписанием внутри базы.
 *
 * Авторизации нет намеренно. Посторонний вызов не даёт ничего: функция сама
 * выбирает, кто давно молчит, отправляет не чаще раза в полсуток на
 * человека и в ответе не раскрывает ни имён, ни сколько их. Единственное,
 * чего добился бы злоумышленник, — отправки, которая и так случилась бы
 * через несколько минут. Любой секрет здесь пришлось бы где-то хранить, и
 * место хранения стало бы уязвимее самой функции.
 */
async function handleSweep(): Promise<Response> {
  const db = service();
  const { data, error } = await db.rpc('esla_telegram_silent_patients', {
    p_after_hours: SILENCE_AFTER_HOURS,
  });
  if (error) {
    console.error('[esla] молчащие не получены', error.message);
    return json({ error: 'failed' }, 500);
  }

  let silence = 0;
  for (const row of (data ?? []) as { patient_id: string; patient_name: string | null }[]) {
    silence += await fanOut(
      row.patient_id,
      'silence',
      SILENCE_COOLDOWN_MINUTES,
      silenceText(label(row.patient_name), SILENCE_AFTER_HOURS),
    );
  }

  const missed = await sweepMissed();
  return json({ sent: silence + missed, silence, missed });
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
  const { data, error } = await db.rpc('esla_telegram_missed_doses', {
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
      missedText(label(row.patient_name), row.medicines),
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
  if (!BOT_TOKEN) return json({ error: 'no-bot-token' }, 503);
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
