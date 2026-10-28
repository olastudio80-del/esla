import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { dayProgress, listDosesForDate, markDose, nextActionableDose } from '@/db/doses';
import type { DayProgress } from '@/db/doses';
import type { DoseStatus, DoseWithMedication } from '@/db/types';
import { snoozeDose } from '@/features/notifications';
import { usePrefs } from '@/store/prefs';

type State = {
  /** Доза для большой карточки: ближайшая неотмеченная. */
  current: DoseWithMedication | null;
  /** Все дозы на сегодня по времени. */
  today: DoseWithMedication[];
  progress: DayProgress;
  loading: boolean;
};

const INITIAL: State = {
  current: null,
  today: [],
  progress: { taken: 0, total: 0 },
  loading: true,
};

/**
 * Дозы на сегодня для главного экрана. Перезагружается при каждом возврате
 * на экран: человек мог отметить приём из уведомления или добавить лекарство,
 * и показывать устаревший список в приложении про лекарства недопустимо.
 */
export function useTodayDoses() {
  const { prefs } = usePrefs();
  const [state, setState] = useState<State>(INITIAL);

  const reload = useCallback(async () => {
    const [current, today, progress] = await Promise.all([
      nextActionableDose(),
      listDosesForDate(),
      dayProgress(),
    ]);
    setState({ current, today, progress, loading: false });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      reload().catch((error) => {
        console.warn('[esla] не удалось загрузить дозы', error);
        if (alive) setState((s) => ({ ...s, loading: false }));
      });
      return () => {
        alive = false;
      };
    }, [reload]),
  );

  const act = useCallback(
    async (dose: DoseWithMedication, status: DoseStatus) => {
      await markDose(dose.id, status);
      await reload();
    },
    [reload],
  );

  const snooze = useCallback(
    async (dose: DoseWithMedication) => {
      await snoozeDose(prefs.lang, dose.name, dose.dosage, prefs.snoozeMinutes);
    },
    [prefs.lang, prefs.snoozeMinutes],
  );

  return { ...state, reload, act, snooze };
}
