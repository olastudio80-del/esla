import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';

import type { Lang } from '@/store/prefs';

/**
 * Голос помощника: озвучить вопрос, выслушать ответ, вернуть текст.
 *
 * Почему без языковой модели. Задача помощника узкая: задать вопрос из
 * заранее известного списка, услышать ответ и записать его. Понимать ответ
 * не нужно — на закрытый вопрос хватает сопоставления с ожидаемыми
 * вариантами (см. matchSpoken в lib/text), а свободный рассказ сохраняется
 * дословно: интерпретировать его мы и не собирались.
 *
 * Отсюда следует всё остальное: распознавание идёт на самом телефоне,
 * работает без интернета, ничего не стоит и не отправляет голос пожилого
 * человека на чужой сервер.
 *
 * Голос нигде не единственный способ ответить: кнопки на экране остаются
 * всегда. Распознавание может не понять, язык может быть не установлен,
 * микрофон может быть занят — ни один из этих случаев не должен лишить
 * человека возможности сказать, что он себя плохо чувствует.
 */

/** Коды языков в формате BCP-47, как их ждут системные движки. */
export const LOCALE: Record<Lang, string> = { uz: 'uz-UZ', ru: 'ru-RU' };

export type VoiceCapabilities = {
  /** Распознавание речи на устройстве в принципе доступно. */
  recognition: boolean;
  /** Язык поддерживается распознаванием (возможно, только онлайн). */
  localeSupported: boolean;
  /** Языковой пакет установлен — распознавание будет работать без интернета. */
  offlineReady: boolean;
  /** На устройстве есть голос для озвучки на этом языке. */
  speech: boolean;
};

export const NO_VOICE: VoiceCapabilities = {
  recognition: false,
  localeSupported: false,
  offlineReady: false,
  speech: false,
};

/**
 * Что телефон умеет на выбранном языке.
 *
 * Проверка нужна до того, как предлагать голос: узбекские языковые пакеты
 * есть не на всех устройствах, и обещать голосовой ввод там, где он не
 * заработает, нельзя.
 */
export async function checkVoice(lang: Lang): Promise<VoiceCapabilities> {
  const locale = LOCALE[lang];
  const result: VoiceCapabilities = { ...NO_VOICE };

  try {
    result.recognition = ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return result;
  }

  try {
    // Пакеты для офлайна живёт в сервисе Google «Android System Intelligence».
    const { locales, installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({
      androidRecognitionServicePackage:
        Platform.OS === 'android' ? 'com.google.android.as' : undefined,
    });
    result.localeSupported = includesLocale(locales, locale);
    result.offlineReady = includesLocale(installedLocales, locale);
  } catch {
    // Android 12 и ниже списка не отдаёт. Это не значит, что язык не работает,
    // поэтому считаем его поддерживаемым и проверим попыткой запуска.
    result.localeSupported = true;
  }

  try {
    const voices = await Speech.getAvailableVoicesAsync();
    result.speech = voices.some((voice) => sameLanguage(voice.language, locale));
  } catch {
    // Список голосов недоступен — озвучку всё равно попробуем,
    // системный движок часто справляется без объявленного голоса.
    result.speech = true;
  }

  return result;
}

/** 'uz-UZ' и 'uz_UZ' и 'uz' — один и тот же язык. */
function sameLanguage(a: string, b: string): boolean {
  const base = (value: string) => value.replace('_', '-').split('-')[0]?.toLowerCase();
  return base(a) === base(b);
}

function includesLocale(list: string[], locale: string): boolean {
  return list.some((item) => sameLanguage(item, locale));
}

export async function requestVoicePermission(): Promise<boolean> {
  try {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

/**
 * Предлагает системе скачать языковой пакет для работы без интернета.
 * Android 13 просто показывает диалог, 14+ сообщает результат.
 */
export async function downloadOfflineModel(lang: Lang): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({
      locale: LOCALE[lang],
    });
    return true;
  } catch {
    return false;
  }
}

/** Озвучивает текст и ждёт, пока договорит: иначе вопрос наложится на ответ. */
export function speak(text: string, lang: Lang): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    try {
      Speech.speak(text, {
        language: LOCALE[lang],
        // Медленнее обычного: собеседник — пожилой человек.
        rate: 0.92,
        onDone: done,
        onStopped: done,
        onError: done,
      });
    } catch {
      done();
    }
  });
}

export function stopSpeaking(): void {
  Speech.stop().catch(() => {});
}

export type ListenOptions = {
  lang: Lang;
  /** Требовать распознавание на устройстве: без интернета и без отправки голоса. */
  offline: boolean;
  /** Сколько ждать ответа, прежде чем сдаться и показать кнопки. */
  timeoutMs?: number;
  /** Промежуточный текст — чтобы человек видел, что его слышат. */
  onPartial?: (text: string) => void;
};

export type ListenResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'no-speech' | 'denied' | 'unavailable' | 'error' };

/**
 * Слушает один ответ и возвращает распознанный текст.
 *
 * Всегда завершается: по финальному результату, по концу речи, по ошибке
 * или по таймеру. Зависнуть в режиме прослушивания экран не должен —
 * пожилой человек не поймёт, что происходит, и не догадается нажать «стоп».
 */
export function listenOnce(options: ListenOptions): Promise<ListenResult> {
  const { lang, offline, timeoutMs = 12_000, onPartial } = options;

  return new Promise((resolve) => {
    let settled = false;
    let latest = '';
    const subscriptions: { remove: () => void }[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: ListenResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      for (const sub of subscriptions) {
        try {
          sub.remove();
        } catch {
          // Отписка после завершения модуля — не повод падать.
        }
      }
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // Уже остановлено.
      }
      resolve(result);
    };

    try {
      subscriptions.push(
        ExpoSpeechRecognitionModule.addListener('result', (event) => {
          const text = event.results?.[0]?.transcript ?? '';
          if (text) {
            latest = text;
            if (!event.isFinal) onPartial?.(text);
          }
          if (event.isFinal && latest.trim()) finish({ ok: true, text: latest.trim() });
        }),
      );

      subscriptions.push(
        ExpoSpeechRecognitionModule.addListener('error', (event) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            finish({ ok: false, reason: 'denied' });
            return;
          }
          if (event.error === 'language-not-supported') {
            finish({ ok: false, reason: 'unavailable' });
            return;
          }
          // Речь не распознана — частый и ожидаемый случай, не ошибка.
          finish({ ok: false, reason: event.error === 'no-speech' ? 'no-speech' : 'error' });
        }),
      );

      subscriptions.push(
        ExpoSpeechRecognitionModule.addListener('end', () => {
          // Движок закончил сам: отдаём последнее, что услышали.
          if (latest.trim()) finish({ ok: true, text: latest.trim() });
          else finish({ ok: false, reason: 'no-speech' });
        }),
      );

      ExpoSpeechRecognitionModule.start({
        lang: LOCALE[lang],
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: offline,
        // Немного терпения к паузам: пожилые говорят медленнее.
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
        },
      });

      timer = setTimeout(() => {
        if (latest.trim()) finish({ ok: true, text: latest.trim() });
        else finish({ ok: false, reason: 'no-speech' });
      }, timeoutMs);
    } catch {
      finish({ ok: false, reason: 'unavailable' });
    }
  });
}

export function stopListening(): void {
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch {
    // Уже остановлено.
  }
}
