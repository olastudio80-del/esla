import { EMPTY_SNAPSHOT, type HealthProvider } from './types';

/**
 * Заглушка для платформ без данных о здоровье (веб, неизвестная платформа).
 * Metro подставит index.android.ts или index.ios.ts, а TypeScript типизирует
 * всё приложение по этому файлу — поэтому формы обязаны совпадать.
 */
export const health: HealthProvider = {
  kind: 'none',
  check: async () => 'unsupported',
  request: async () => false,
  openSettings: async () => {},
  read: async () => EMPTY_SNAPSHOT,
};

export * from './types';
