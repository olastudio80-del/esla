/**
 * Отправка push через Firebase Cloud Messaging.
 *
 * Обращаемся прямо к FCM, а не к службе push-уведомлений Expo: та
 * потребовала бы учётной записи Expo и загрузки туда же наших ключей
 * Firebase, то есть ещё одного посредника на пути к телефону человека.
 * Токен устройства приложение получает нативный, и отправлять по нему
 * может кто угодно, у кого есть сервисный ключ проекта Firebase.
 *
 * Сервисный ключ лежит в секрете FCM_SERVICE_ACCOUNT целиком, как его
 * выдаёт консоль Firebase. Нет секрета — push просто не отправляется, а
 * телеграм работает: один ненастроенный канал не должен останавливать
 * второй.
 */

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export type PushNotice = {
  title: string;
  body: string;
  /** Повод: по нему приложение решает, куда открыться по нажатию. */
  kind: string;
};

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
/** Токен доступа живёт час; берём с запасом, чтобы не попасть на границу. */
const TOKEN_TTL_MS = 50 * 60 * 1000;

let account: ServiceAccount | null | undefined;
let cachedToken: { value: string; until: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) {
    account = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    account = parsed.project_id && parsed.client_email && parsed.private_key ? parsed : null;
    if (!account) console.error('[esla] FCM_SERVICE_ACCOUNT без нужных полей');
  } catch (error) {
    console.error('[esla] FCM_SERVICE_ACCOUNT не разбирается как JSON', error);
    account = null;
  }
  return account;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeJson(value: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

/** PEM из сервисного ключа — в двоичный вид, который понимает crypto. */
function pkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Токен доступа Google: подписываем сервисным ключом утверждение о том,
 * кто мы, и обмениваем его на токен. Это тот же обмен, что делают
 * библиотеки Google, только без самих библиотек — нам нужна одна область
 * доступа, а не весь их набор.
 */
async function accessToken(sa: ServiceAccount): Promise<string | null> {
  if (cachedToken && cachedToken.until > Date.now()) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    encodeJson({ alg: 'RS256', typ: 'JWT' }),
    encodeJson({
      iss: sa.client_email,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ].join('.');

  try {
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pkcs8(sa.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(unsigned),
    );

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${base64url(new Uint8Array(signature))}`,
      }),
    });

    const payload = (await response.json()) as { access_token?: string; error?: string };
    if (!response.ok || !payload.access_token) {
      console.error('[esla] токен доступа Google не получен', payload.error ?? response.status);
      return null;
    }

    cachedToken = { value: payload.access_token, until: Date.now() + TOKEN_TTL_MS };
    return cachedToken.value;
  } catch (error) {
    console.error('[esla] не удалось подписать запрос к Google', error);
    return null;
  }
}

/** Канал Android, в который попадают эти уведомления. Создаёт его приложение. */
const CHANNEL = 'family-alerts';

/**
 * Разослать push. Возвращает число доставленных.
 *
 * Про каждый мёртвый токен сообщаем вызывающему через onGone: устройство
 * переустановили или почистили, и держать такой токен значит писать в
 * пустоту при каждой тревоге.
 */
export async function sendPush(
  tokens: string[],
  notice: PushNotice,
  onGone: (token: string) => Promise<void>,
): Promise<number> {
  if (tokens.length === 0) return 0;
  const sa = serviceAccount();
  if (!sa) return 0;
  const token = await accessToken(sa);
  if (!token) return 0;

  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const results = await Promise.all(
    tokens.map(async (device) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: device,
            notification: { title: notice.title, body: notice.body },
            data: { kind: notice.kind },
            android: {
              // Тревога о близком человеке не должна ждать, пока система
              // решит разбудить приложение.
              priority: 'HIGH',
              notification: { channel_id: CHANNEL, default_sound: true },
            },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: { aps: { sound: 'default' } },
            },
          },
        }),
      });

      if (response.ok) return true;

      const text = await response.text();
      // 404 и NOT_FOUND/UNREGISTERED означают именно мёртвый токен.
      if (response.status === 404 || text.includes('UNREGISTERED')) {
        await onGone(device).catch(() => {});
      } else {
        console.warn('[esla] push не доставлен', response.status, text.slice(0, 200));
      }
      return false;
    }),
  );

  return results.filter(Boolean).length;
}
