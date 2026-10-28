import {
  getRequestStatusForAuthorization,
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { AuthorizationRequestStatus } from '@react-native-healthkit/core';
import { Linking } from 'react-native';

import { EMPTY_SNAPSHOT, type HealthProvider, type HealthSnapshot, type VitalSample } from './types';

import { localISO } from '@/lib/date';

/**
 * HealthKit: пульс, шаги и сон из приложения «Здоровье». На iOS данные туда
 * пишут Apple Watch и приложения фитнес-браслетов.
 *
 * ОСОБЕННОСТЬ APPLE: узнать, дал ли пользователь доступ НА ЧТЕНИЕ, нельзя —
 * Apple скрывает это, чтобы приложение не делало выводов из самого отказа.
 * Поэтому «пусто» на iOS означает либо отсутствие доступа, либо отсутствие
 * данных, и различить их невозможно. Интерфейс в этом случае предлагает
 * открыть «Здоровье» и проверить разрешения — без обвинений в чей-либо адрес.
 */
const READ_TYPES = [
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;

/** Значения HKCategoryValueSleepAnalysis, означающие именно сон, а не «в постели». */
const ASLEEP_VALUES = new Set([1, 3, 4, 5]);

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function lastNightRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 1);
  startDate.setHours(18, 0, 0, 0);
  const noon = new Date(now);
  noon.setHours(12, 0, 0, 0);
  return { startDate, endDate: noon > now ? now : noon };
}

export const health: HealthProvider = {
  kind: 'healthkit',

  async check() {
    if (!(await isHealthDataAvailableAsync())) return 'unsupported';
    const status = await getRequestStatusForAuthorization({ toRead: READ_TYPES });
    // shouldRequest — разрешение ещё ни разу не спрашивали.
    return status === AuthorizationRequestStatus.shouldRequest ? 'needs-permission' : 'ready';
  },

  async request() {
    if (!(await isHealthDataAvailableAsync())) return false;
    // true означает «диалог показан и закрыт», а не «доступ дан»:
    // что именно разрешили, Apple не сообщает.
    return requestAuthorization({ toRead: READ_TYPES });
  },

  async openSettings() {
    // Разрешения HealthKit живут в приложении «Здоровье», не в настройках приложения.
    await Linking.openURL('x-apple-health://').catch(() => Linking.openSettings());
  },

  async read(): Promise<HealthSnapshot> {
    if (!(await isHealthDataAvailableAsync())) return EMPTY_SNAPSHOT;
    const [heartRate, steps, sleepMinutes] = await Promise.all([
      readHeartRate(),
      readSteps(),
      readSleep(),
    ]);
    return { heartRate, steps, sleepMinutes };
  },
};

async function readHeartRate(): Promise<VitalSample | null> {
  try {
    const samples = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      limit: 1,
      ascending: false, // самое свежее измерение
      unit: 'count/min',
    });
    const sample = samples[0];
    if (!sample) return null;
    return {
      value: Math.round(sample.quantity),
      measuredAt: localISO(new Date(sample.endDate)),
      source: sample.sourceRevision?.source?.name ?? null,
    };
  } catch {
    return null;
  }
}

async function readSteps(): Promise<VitalSample | null> {
  try {
    const stats = await queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      { filter: { date: { startDate: startOfToday(), endDate: new Date() } }, unit: 'count' },
    );
    const total = stats.sumQuantity?.quantity;
    if (total == null) return null;
    return {
      value: Math.round(total),
      measuredAt: localISO(stats.endDate ?? new Date()),
      source: stats.sources[0]?.name ?? null,
    };
  } catch {
    return null;
  }
}

async function readSleep(): Promise<VitalSample | null> {
  try {
    const range = lastNightRange();
    const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      limit: 0, // все записи за ночь
      ascending: false,
      filter: { date: range },
    });
    let minutes = 0;
    let latest: Date | null = null;
    let source: string | null = null;
    for (const sample of samples) {
      if (!ASLEEP_VALUES.has(sample.value)) continue;
      const from = new Date(sample.startDate).getTime();
      const to = new Date(sample.endDate).getTime();
      minutes += Math.max(0, (to - from) / 60_000);
      if (!latest || new Date(sample.endDate) > latest) {
        latest = new Date(sample.endDate);
        source = sample.sourceRevision?.source?.name ?? null;
      }
    }
    if (minutes === 0) return null;
    return { value: Math.round(minutes), measuredAt: localISO(latest ?? new Date()), source };
  } catch {
    return null;
  }
}

export * from './types';
