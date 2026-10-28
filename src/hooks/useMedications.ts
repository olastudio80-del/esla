import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { archiveMedication, listMedications } from '@/db/medications';
import type { Medication } from '@/db/types';
import { rescheduleAll } from '@/features/notifications';
import { usePrefs } from '@/store/prefs';

/**
 * Список лекарств. После любого изменения расписание уведомлений
 * пересобирается целиком — иначе в системе остались бы напоминания об
 * отменённом лекарстве.
 */
export function useMedications() {
  const { prefs } = usePrefs();
  const [items, setItems] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const meds = await listMedications();
    setItems(meds);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((error) => {
        console.warn('[esla] не удалось загрузить лекарства', error);
        setLoading(false);
      });
    }, [reload]),
  );

  const remove = useCallback(
    async (id: number) => {
      await archiveMedication(id);
      await reload();
      await rescheduleAll(prefs.lang);
    },
    [reload, prefs.lang],
  );

  return { items, loading, reload, remove };
}
