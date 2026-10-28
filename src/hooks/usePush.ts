import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { registerPushDevice, type PushState } from '@/features/push';
import { usePrefs } from '@/store/prefs';

/**
 * Регистрация этого телефона как получателя тревог о близком.
 *
 * Регистрируем один раз за запуск: токен меняется редко, а каждый лишний
 * вызов — это запрос в сеть на экране, который человек открывает часто.
 * При смене токена уведомление перестанет доходить до следующего запуска,
 * и это приемлемо: сервер в тот же момент узнаёт, что токен мёртв, и
 * удаляет его, а телеграм остаётся.
 */
let registered: PushState | null = null;

export function usePush(): { state: PushState | null; retry: () => void } {
  const { prefs } = usePrefs();
  const [state, setState] = useState<PushState | null>(registered);

  const register = useCallback(() => {
    void registerPushDevice().then((next) => {
      registered = next;
      setState(next);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Тревоги приходят тому, кто следит, а не тому, за кем следят.
      if (prefs.role !== 'relative') return;
      if (registered !== null) {
        setState(registered);
        return;
      }
      register();
    }, [prefs.role, register]),
  );

  return { state, retry: register };
}
