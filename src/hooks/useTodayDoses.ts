import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { dayProgress, listDosesForDate, markDose, nextActionableDose } from '@/db/doses';
import type { DayProgress } from '@/db/doses';
import type { DoseStatus, DoseWithMedication } from '@/db/types';
import { pushPatientState } from '@/features/cloud/sync';
import { health } from '@/features/health';
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
 * Как часто открытие экрана отправляет план наверх.
 *
 * Отправка при каждом возврате на вкладку была бы запросом в сеть на
 * каждое переключение. Получаса достаточно: план меняется редко, а отметка
 * приёма уходит отдельно и сразу.
 */
const PLAN_PUSH_INTERVAL_MS = 30 * 60 * 1000;

let lastPlanPush = 0;

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

      // Открытие приложения — это и отметка «был на связи», и повод
      // обновить план на сервере: человек мог завести лекарство на другом
      // экране или просто начать новый день.
      const now = Date.now();
      if (now - lastPlanPush > PLAN_PUSH_INTERVAL_MS) {
        lastPlanPush = now;
        void health
          .read()
          .catch(() => null)
          .then((vitals) => pushPatientState(vitals));
      }

      return () => {
        alive = false;
      };
    }, [reload]),
  );

  const act = useCallback(
    async (dose: DoseWithMedication, status: DoseStatus) => {
      await markDose(dose.id, status);
      await reload();
      // Родственник должен увидеть отметку сразу. Отправка в фоне:
      // подтверждение приёма не ждёт сети, иначе кнопка «Ichdim»
      // подвисала бы при плохой связи.
      void health
        .read()
        .catch(() => null)
        .then((vitals) => pushPatientState(vitals));
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
