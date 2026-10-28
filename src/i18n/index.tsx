import { useCallback } from 'react';

import { usePrefs, type Lang } from '@/store/prefs';
import { textSizeFactor, typeScale, type TypeKey } from '@/theme/tokens';

import { ru } from './ru';
import type { Dict, TKey } from './types';
import { uz } from './uz';

const dicts: Record<Lang, Dict> = { uz, ru };

export type Translate = (key: TKey, params?: Record<string, string | number>) => string;

/** Подставляет {name}-заглушки. Отсутствующий параметр оставляем как есть — заметно при отладке. */
function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export function translate(lang: Lang, key: TKey, params?: Record<string, string | number>) {
  return interpolate(dicts[lang][key], params);
}

/** Перевод строк в компонентах. */
export function useT() {
  const { prefs } = usePrefs();
  const t = useCallback<Translate>(
    (key, params) => translate(prefs.lang, key, params),
    [prefs.lang],
  );
  return { t, lang: prefs.lang };
}

/**
 * Размеры шрифта через настройку «размер текста».
 * Компоненты просят смысловой размер (`body`, `title`), а не число.
 */
export function useType() {
  const { prefs } = usePrefs();
  const factor = textSizeFactor[prefs.textSize];
  return useCallback((key: TypeKey) => Math.round(typeScale[key] * factor), [factor]);
}

export { ru, uz };
export type { Dict, TKey };
