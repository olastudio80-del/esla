import { getDb } from './index';

import { localISO } from '@/lib/date';

export type Feeling = 'good' | 'ok' | 'bad';
export type CheckinSource = 'assistant' | 'manual';

export type CheckinRow = {
  id: number;
  created_at: string;
  feeling: Feeling;
  /** JSON-массив строк — в базе TEXT, наружу отдаём разобранным. */
  symptoms: string;
  severity: number | null;
  note: string | null;
  source: CheckinSource;
  alarm: number;
  synced: number;
};

export type Checkin = Omit<CheckinRow, 'symptoms' | 'alarm'> & {
  symptoms: string[];
  alarm: boolean;
};

export type CheckinInput = {
  feeling: Feeling;
  symptoms?: string[];
  /** Насколько беспокоит, 1..5. */
  severity?: number | null;
  note?: string | null;
  source: CheckinSource;
  /**
   * Тревожный симптом, при котором помощник обязан прекратить опрос и
   * направить к врачу: боль в груди, одышка, спутанность сознания,
   * кровотечение и подобное.
   */
  alarm?: boolean;
};

function toCheckin(row: CheckinRow): Checkin {
  let symptoms: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.symptoms);
    if (Array.isArray(parsed)) symptoms = parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    // Сломанный JSON не должен прятать саму запись: покажем без симптомов.
  }
  const { symptoms: _raw, alarm, ...rest } = row;
  return { ...rest, symptoms, alarm: alarm === 1 };
}

export async function addCheckin(input: CheckinInput): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO checkins (created_at, feeling, symptoms, severity, note, source, alarm)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      localISO(),
      input.feeling,
      JSON.stringify(input.symptoms ?? []),
      input.severity ?? null,
      input.note?.trim() || null,
      input.source,
      input.alarm ? 1 : 0,
    ],
  );
  return res.lastInsertRowId;
}

export async function listCheckins(limit = 50): Promise<Checkin[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CheckinRow>(
    'SELECT * FROM checkins ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
  return rows.map(toCheckin);
}

/** Записи для экстренной медкарты: свежие и все тревожные. */
export async function checkinsForMedicalCard(days = 30): Promise<Checkin[]> {
  const db = await getDb();
  const since = localISO(new Date(Date.now() - days * 86_400_000));
  const rows = await db.getAllAsync<CheckinRow>(
    `SELECT * FROM checkins
      WHERE created_at >= ? OR alarm = 1
      ORDER BY created_at DESC`,
    [since],
  );
  return rows.map(toCheckin);
}

export async function lastCheckin(): Promise<Checkin | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CheckinRow>(
    'SELECT * FROM checkins ORDER BY created_at DESC LIMIT 1',
  );
  return row ? toCheckin(row) : null;
}

/** Тревожные записи, о которых ещё не знает родственник. */
export async function unsyncedAlarms(): Promise<Checkin[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CheckinRow>(
    'SELECT * FROM checkins WHERE alarm = 1 AND synced = 0 ORDER BY created_at',
  );
  return rows.map(toCheckin);
}

export async function markCheckinsSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE checkins SET synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
}
