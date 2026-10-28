import { useCallback, useEffect, useRef, useState } from 'react';

import {
  NO_VOICE,
  checkVoice,
  listenOnce,
  requestVoicePermission,
  speak,
  stopListening,
  stopSpeaking,
  type VoiceCapabilities,
} from '@/features/voice';
import { matchSpoken } from '@/lib/text';
import { usePrefs } from '@/store/prefs';

export type VoiceState = 'idle' | 'speaking' | 'listening';

/** Что с доступом к микрофону: ещё не спрашивали, дали или отказали. */
export type MicPermission = 'unknown' | 'granted' | 'denied';

/**
 * Голосовой вопрос: озвучить, выслушать, вернуть ответ.
 *
 * Голос здесь — дополнение к кнопкам, а не замена. Любой отказ (нет
 * разрешения, язык не установлен, не распознало) просто возвращает null,
 * и экран продолжает работать нажатиями. Поэтому тут нет состояния ошибки:
 * нераспознанный ответ — это обычный ход событий, а не сбой.
 */
export function useVoiceAsk() {
  const { prefs } = usePrefs();
  const [capabilities, setCapabilities] = useState<VoiceCapabilities>(NO_VOICE);
  const [state, setState] = useState<VoiceState>('idle');
  const [partial, setPartial] = useState('');
  const [permission, setPermission] = useState<MicPermission>('unknown');
  // Отменённый вопрос не должен продолжать говорить в уже закрытом экране.
  const cancelled = useRef(false);

  useEffect(() => {
    let alive = true;
    checkVoice(prefs.lang).then((caps) => {
      if (alive) setCapabilities(caps);
    });
    return () => {
      alive = false;
      cancelled.current = true;
      stopSpeaking();
      stopListening();
    };
  }, [prefs.lang]);

  /** Голос доступен и включён пользователем. */
  const enabled = prefs.voiceEnabled && capabilities.recognition && capabilities.localeSupported;

  const cancel = useCallback(() => {
    cancelled.current = true;
    stopSpeaking();
    stopListening();
    setState('idle');
    setPartial('');
  }, []);

  /** Озвучивает вопрос и слушает свободный ответ; возвращает текст как есть. */
  const dictate = useCallback(
    async (question?: string): Promise<string | null> => {
      if (!enabled) return null;
      cancelled.current = false;
      setPartial('');

      // Разрешение на микрофон спрашиваем перед первым прослушиванием.
      // Без него система молча отказывает, и человек видит, что «ничего
      // не происходит», — а это выглядит как сломанное приложение.
      if (permission !== 'granted') {
        const granted = await requestVoicePermission();
        setPermission(granted ? 'granted' : 'denied');
        if (!granted) return null;
      }

      if (question) {
        setState('speaking');
        await speak(question, prefs.lang);
        if (cancelled.current) return null;
      }

      setState('listening');
      const result = await listenOnce({
        lang: prefs.lang,
        // Офлайн только если языковой пакет действительно установлен:
        // иначе движок откажется вместо того, чтобы спросить интернет.
        offline: capabilities.offlineReady,
        onPartial: setPartial,
      });
      setState('idle');
      setPartial('');

      if (cancelled.current || !result.ok) return null;
      return result.text;
    },
    [enabled, prefs.lang, capabilities.offlineReady, permission],
  );

  /** Тот же вопрос, но ответ сопоставляется с ожидаемыми вариантами. */
  const ask = useCallback(
    async <T>(
      question: string,
      options: { value: T; phrases: string[] }[],
    ): Promise<{ value: T | null; heard: string | null }> => {
      const heard = await dictate(question);
      if (heard === null) return { value: null, heard: null };
      return { value: matchSpoken(heard, options), heard };
    },
    [dictate],
  );

  return { enabled, capabilities, permission, state, partial, ask, dictate, cancel };
}
