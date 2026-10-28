import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Бот esla: подписывает близких на тревоги и отписывает их.
 *
 * Весь обмен с телеграмом живёт здесь, а не в приложении, по одной причине:
 * токен бота нельзя отдавать в APK. Разобрать APK умеет любой, и тогда от
 * имени нашего бота писал бы кто угодно.
 *
 * Как человек подписывается: родитель показывает в приложении ссылку
 * t.me/<бот>?start=КОД, близкий открывает её и нажимает «Start». Больше
 * ничего — ни приложения, ни аккаунта, ни номера телефона.
 */

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/**
 * Пароль вебхука выводим из токена бота, а не храним отдельным секретом.
 *
 * Телеграм присылает его в заголовке каждого запроса, и подделать заголовок
 * может только тот, кто знает токен бота. Так настройка требует от человека
 * ровно одного секрета вместо двух — а каждый лишний секрет это ещё один
 * шаг, на котором всё встаёт.
 */
async function webhookSecret(): Promise<string> {
  const data = new TextEncoder().encode(`${BOT_TOKEN}/esla-webhook`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function telegram(method: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Ответы бота сразу на двух языках.
 *
 * Язык близкого нам неизвестен — в телеграме он может стоять любой, а
 * семья в Узбекистане обычно читает оба. Угадывать по language_code
 * надёжнее не станет, а ошибка угадывания здесь означает непонятное
 * сообщение в единственный момент, когда человека и так тревожат.
 */
const TEXT = {
  help: [
    'esla — dori eslatmasi.',
    '',
    'Yaqiningiz haqida ogohlantirish olish uchun ilovadagi kodni yuboring.',
    'Toʻxtatish: /stop',
    '',
    'esla — напоминания о лекарствах.',
    '',
    'Чтобы получать предупреждения о близком, отправьте код из приложения.',
    'Отключить: /stop',
  ].join('\n'),
  linked: (name: string) =>
    [
      `✅ ${name} haqida ogohlantirishlar yoqildi.`,
      'Toʻxtatish uchun /stop yuboring.',
      '',
      `✅ Предупреждения о ${name} включены.`,
      'Чтобы отключить, отправьте /stop.',
    ].join('\n'),
  wrongCode: [
    '❌ Kod notoʻgʻri yoki muddati oʻtgan. Ilovada yangi kod oling.',
    '',
    '❌ Код неверный или просрочен. Возьмите новый код в приложении.',
  ].join('\n'),
  stopped: [
    'Ogohlantirishlar oʻchirildi.',
    '',
    'Предупреждения отключены.',
  ].join('\n'),
  nothingToStop: [
    'Siz hech kimga obuna boʻlmagansiz.',
    '',
    'Вы ни на кого не подписаны.',
  ].join('\n'),
};

/** Имя для сообщений: без имени в профиле — нейтральное слово. */
function patientLabel(name: string | null): string {
  return name && name.trim() ? name.trim() : 'yaqiningiz / ваш близкий';
}

async function handleUpdate(update: Record<string, any>): Promise<void> {
  const message = update.message ?? update.edited_message;
  const chatId: number | undefined = message?.chat?.id;
  const text: string | undefined = message?.text;
  if (!chatId || typeof text !== 'string') return;

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const trimmed = text.trim();

  if (trimmed === '/stop') {
    const { data } = await db.rpc('esla_unlink_telegram', { p_chat: chatId });
    const removed = typeof data === 'number' ? data : 0;
    await telegram('sendMessage', {
      chat_id: chatId,
      text: removed > 0 ? TEXT.stopped : TEXT.nothingToStop,
    });
    return;
  }

  // Код приходит либо как «/start КОД» по ссылке, либо просто сообщением:
  // пожилой человек может переслать код близкому, и тот отправит его как
  // есть, не поняв, что это команда.
  const startMatch = /^\/start(?:\s+(\S+))?$/i.exec(trimmed);
  const bare = /^[A-Za-z0-9]{6}$/.test(trimmed) ? trimmed : null;
  const code = startMatch ? startMatch[1] : bare;

  if (!code) {
    await telegram('sendMessage', { chat_id: chatId, text: TEXT.help });
    return;
  }

  const title = [message?.from?.first_name, message?.from?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  const { data, error } = await db.rpc('esla_link_telegram', {
    p_code: code,
    p_chat: chatId,
    p_title: title || null,
  });

  if (error || !data?.[0]) {
    await telegram('sendMessage', { chat_id: chatId, text: TEXT.wrongCode });
    return;
  }

  await telegram('sendMessage', {
    chat_id: chatId,
    text: TEXT.linked(patientLabel(data[0].patient_name)),
  });
}

/**
 * Разовая настройка: сказать телеграму, куда присылать сообщения.
 *
 * Открыта намеренно и ничего не раскрывает: вызов лишь перерегистрирует
 * тот же самый адрес. Человек должен иметь возможность нажать одну ссылку
 * в браузере, не вставляя токен бота в адресную строку.
 */
async function handleSetup(): Promise<Response> {
  const secret = await webhookSecret();
  const me = await telegram('getMe', {});
  const hook = await telegram('setWebhook', {
    url: `${SUPABASE_URL}/functions/v1/telegram-bot`,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });

  const username = (me.result as Record<string, unknown> | undefined)?.username;
  const lines = [
    hook.ok ? 'Вебхук зарегистрирован.' : `Вебхук не зарегистрирован: ${hook.description}`,
    username ? `Бот: @${username}` : `Бот не отвечает: ${me.description ?? 'нет токена'}`,
    username ? `Ссылка для подписки: https://t.me/${username}?start=КОД` : '',
  ].filter(Boolean);

  return new Response(`${lines.join('\n')}\n`, {
    status: hook.ok ? 200 : 502,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Имя бота для приложения.
 *
 * Приложение показывает человеку ссылку t.me/<бот>?start=КОД, а имя бота
 * зависит от того, какого бота завели в BotFather. Спрашивать его здесь
 * надёжнее, чем прописывать в настройках приложения: иначе после смены
 * бота пришлось бы пересобирать APK.
 */
let cachedUsername: string | null = null;

async function handleInfo(): Promise<Response> {
  if (!cachedUsername) {
    const me = await telegram('getMe', {});
    const result = me.result as Record<string, unknown> | undefined;
    cachedUsername = typeof result?.username === 'string' ? result.username : null;
  }
  return new Response(JSON.stringify({ username: cachedUsername }), {
    status: cachedUsername ? 200 : 502,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (!BOT_TOKEN) {
    return new Response('TELEGRAM_BOT_TOKEN не задан\n', { status: 503 });
  }

  const path = new URL(req.url).pathname;
  if (path.endsWith('/setup')) return handleSetup();
  if (path.endsWith('/info')) return handleInfo();

  if (req.method !== 'POST') {
    return new Response('ok\n', { status: 200 });
  }

  const given = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  const expected = await webhookSecret();
  if (given !== expected) {
    return new Response('forbidden\n', { status: 403 });
  }

  try {
    await handleUpdate(await req.json());
  } catch (error) {
    // Телеграму всё равно отвечаем «принято»: на ошибку он будет повторять
    // доставку, и одна наша поломка превратилась бы в поток повторов.
    console.error('[esla] обработка обновления не удалась', error);
  }
  return new Response('ok\n', { status: 200 });
});
