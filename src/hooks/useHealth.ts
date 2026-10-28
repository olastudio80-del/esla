import { useCallback, useEffect, useState } from 'react';

import { EMPTY_SNAPSHOT, health, type HealthSnapshot, type HealthState } from '@/features/health';

type State = {
  state: HealthState;
  snapshot: HealthSnapshot;
  /** Первая проверка ещё идёт — не показывать «браслет не подключён». */
  checking: boolean;
};

const INITIAL: State = { state: 'unsupported', snapshot: EMPTY_SNAPSHOT, checking: true };

/** Читает состояние и показатели, ничего не меняя в React. */
async function load(): Promise<State> {
  try {
    const state = await health.check();
    const snapshot = state === 'ready' ? await health.read() : EMPTY_SNAPSHOT;
    return { state, snapshot, checking: false };
  } catch (error) {
    // Приложение полностью работает без браслета, поэтому любая ошибка
    // здесь — это «данных нет», а не ошибка на экране.
    console.warn('[esla] данные о здоровье недоступны', error);
    return { state: 'unsupported', snapshot: EMPTY_SNAPSHOT, checking: false };
  }
}

export function useHealth() {
  const [value, setValue] = useState<State>(INITIAL);

  const refresh = useCallback(async () => {
    setValue(await load());
  }, []);

  useEffect(() => {
    // Флаг не даёт записать состояние в размонтированный экран:
    // чтение из Health Connect занимает заметное время.
    let alive = true;
    load().then((next) => {
      if (alive) setValue(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  const request = useCallback(async () => {
    try {
      await health.request();
    } catch (error) {
      console.warn('[esla] запрос доступа к данным не удался', error);
    }
    await refresh();
  }, [refresh]);

  const hasData =
    value.snapshot.heartRate !== null ||
    value.snapshot.steps !== null ||
    value.snapshot.sleepMinutes !== null;

  return {
    ...value,
    hasData,
    kind: health.kind,
    refresh,
    request,
    openSettings: health.openSettings,
  };
}
