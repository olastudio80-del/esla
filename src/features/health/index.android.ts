import {
  SdkAvailabilityStatus,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';
import type { Permission } from 'react-native-health-connect';

import { EMPTY_SNAPSHOT, type HealthProvider, type HealthSnapshot, type VitalSample } from './types';

import { dateKey, localISO } from '@/lib/date';

/** Читаем только то, что показываем: пульс, шаги, сон. Ничего лишнего. */
const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
];

let initialized = false;

async function ensureInitialized(): Promise<boolean> {
  if (initialized) return true;
  initialized = await initialize();
  return initialized;
}

/** Окно поиска данных: сутки назад — дальше показывать уже бессмысленно. */
function dayWindow() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() };
}

function todayWindow() {
  const start = new Date(`${dateKey()}T00:00:00`);
  return {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: new Date().toISOString(),
  };
}

/** Прошлая ночь: с 18:00 вчера до 12:00 сегодня — сон может начаться до полуночи. */
function lastNightWindow() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  return {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: (end > now ? now : end).toISOString(),
  };
}

export const health: HealthProvider = {
  kind: 'health-connect',

  async check() {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'provider-missing';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'provider-update';
    }
    if (!(await ensureInitialized())) return 'provider-missing';

    const granted = await getGrantedPermissions();
    const hasAll = PERMISSIONS.every((want) =>
      granted.some(
        (g) => 'recordType' in g && g.recordType === want.recordType && g.accessType === 'read',
      ),
    );
    return hasAll ? 'ready' : 'needs-permission';
  },

  async request() {
    if (!(await ensureInitialized())) return false;
    const granted = await requestPermission(PERMISSIONS);
    // Пользователь мог разрешить только часть — для нас это уже рабочее состояние.
    return granted.length > 0;
  },

  async openSettings() {
    openHealthConnectSettings();
  },

  async read(): Promise<HealthSnapshot> {
    if (!(await ensureInitialized())) return EMPTY_SNAPSHOT;

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
    const { records } = await readRecords('HeartRate', { timeRangeFilter: dayWindow() });
    let latest: VitalSample | null = null;
    for (const record of records) {
      for (const sample of record.samples) {
        const measuredAt = localISO(new Date(sample.time));
        if (!latest || measuredAt > latest.measuredAt) {
          latest = {
            value: sample.beatsPerMinute,
            measuredAt,
            source: record.metadata?.dataOrigin ?? null,
          };
        }
      }
    }
    return latest;
  } catch {
    // Нет разрешения или источник молчит — показываем «данных нет», не падаем.
    return null;
  }
}

async function readSteps(): Promise<VitalSample | null> {
  try {
    const { records } = await readRecords('Steps', { timeRangeFilter: todayWindow() });
    if (records.length === 0) return null;
    // Health Connect отдаёт шаги кусками по интервалам — суммируем за день.
    let total = 0;
    let lastEnd = '';
    let source: string | null = null;
    for (const record of records) {
      total += record.count;
      if (record.endTime > lastEnd) {
        lastEnd = record.endTime;
        source = record.metadata?.dataOrigin ?? null;
      }
    }
    return { value: total, measuredAt: localISO(new Date(lastEnd)), source };
  } catch {
    return null;
  }
}

async function readSleep(): Promise<VitalSample | null> {
  try {
    const { records } = await readRecords('SleepSession', { timeRangeFilter: lastNightWindow() });
    if (records.length === 0) return null;
    let minutes = 0;
    let lastEnd = '';
    let source: string | null = null;
    for (const record of records) {
      const from = new Date(record.startTime).getTime();
      const to = new Date(record.endTime).getTime();
      minutes += Math.max(0, (to - from) / 60_000);
      if (record.endTime > lastEnd) {
        lastEnd = record.endTime;
        source = record.metadata?.dataOrigin ?? null;
      }
    }
    return { value: Math.round(minutes), measuredAt: localISO(new Date(lastEnd)), source };
  } catch {
    return null;
  }
}

export * from './types';
