import { useCallback, useMemo } from 'react';

import type { Meal } from '@/db/types';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n';

const FORM_KEYS: Record<string, TKey> = {
  tablet: 'formTablet',
  capsule: 'formCapsule',
  syrup: 'formSyrup',
  injection: 'formInjection',
  drops: 'formDrops',
  ointment: 'formOintment',
  powder: 'formPowder',
  spray: 'formSpray',
  inhaler: 'formInhaler',
  patch: 'formPatch',
  suppository: 'formSuppository',
  suspension: 'formSuspension',
  solution: 'formSolution',
  other: 'formOther',
};

/** Подписи, которые встречаются на нескольких экранах: форма выпуска и приём с едой. */
export function useLabels() {
  const { t } = useT();

  const meal = useCallback(
    (value: Meal): string | null => {
      if (value === 'after') return t('afterMeal');
      if (value === 'before') return t('beforeMeal');
      if (value === 'with') return t('withMeal');
      return null;
    },
    [t],
  );

  const form = useCallback(
    (value: string | null): string | null => {
      if (!value) return null;
      const key = FORM_KEYS[value];
      // Неизвестную форму показываем как есть: лучше сырое слово, чем пустота.
      return key ? t(key) : value;
    },
    [t],
  );

  /** «1 tabletka · ovqatdan keyin» — вторая строка карточки дозы. */
  const doseDetails = useCallback(
    (formValue: string | null, mealValue: Meal): string | null => {
      const parts = [form(formValue), meal(mealValue)].filter(Boolean);
      return parts.length ? parts.join(' · ') : null;
    },
    [form, meal],
  );

  return useMemo(() => ({ meal, form, doseDetails }), [meal, form, doseDetails]);
}
