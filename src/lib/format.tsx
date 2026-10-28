import { useCallback } from 'react';

import { useT } from '@/i18n';
import { localISO, minutesBetween, splitDuration } from '@/lib/date';

/**
 * «12 мин назад» для показателей браслета. Это не украшение: данные приходят
 * из приложения браслета с задержкой, и без метки времени пользователь решил
 * бы, что видит пульс прямо сейчас.
 */
export function useAgo() {
  const { t } = useT();
  return useCallback(
    (measuredAt: string) => {
      const minutes = minutesBetween(measuredAt, localISO());
      if (minutes < 2) return t('justNow');
      if (minutes < 60) return t('lastSynced', { ago: `${minutes} ${t('minutesShort')}` });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t('lastSynced', { ago: `${hours} ${t('hoursShort')}` });
      return t('lastSynced', { ago: `${Math.floor(hours / 24)} ${t('daysShort')}` });
    },
    [t],
  );
}

/** Длительность сна: «7 с 20 daq». */
export function useDuration() {
  const { t } = useT();
  return useCallback(
    (totalMinutes: number) => {
      const { hours, minutes } = splitDuration(totalMinutes);
      if (hours === 0) return `${minutes} ${t('minutesShort')}`;
      return `${hours} ${t('hoursShort')} ${minutes} ${t('minutesShort')}`;
    },
    [t],
  );
}

/** Число с разделителем разрядов: 3 240 шагов читается легче, чем 3240. */
export function formatCount(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
