import { getDb } from './index';
import type { DoseStatus, DoseWithMedication } from './types';

import { addDays, atTime, dateKey, localISO } from '@/lib/date';

/**
 * Дозы не создаются на годы вперёд: это раздуло бы базу и ломалось бы при
 * каждой правке расписания. Вместо этого строки на нужный день появляются
 * при первом обращении к нему — а уведомления живут отдельно, в планировщике
 * системы. Поэтому любой экран, который показывает день, сначала вызывает
 * ensureDosesForDate.
 */
export async function ensureDosesForDate(dateISO: string = dateKey()): Promise<void> {
  const db = await getDb();
  const slots = await db.getAllAsync<{
    medication_id: number;
    schedule_time_id: number;
    hour: number;
    minute: number;
  }>(
    `SELECT m.id AS medication_id, s.id AS schedule_time_id, s.hour, s.minute
       FROM medications m
       JOIN schedule_times s ON s.medication_id = m.id
      WHERE m.archived = 0
        AND m.started_on <= ?
        AND (m.course_days IS NULL
             OR date(m.started_on, '+' || (m.course_days - 1) || ' days') >= ?)`,
    [dateISO, dateISO],
  );
  if (slots.length === 0) return;

  await db.withTransactionAsync(async () => {
    for (const slot of slots) {
      // OR IGNORE опирается на UNIQUE(medication_id, planned_at): повторный
      // вызов за тот же день ничего не меняет и не трогает уже принятые дозы.
      await db.runAsync(
        `INSERT OR IGNORE INTO doses (medication_id, schedule_time_id, planned_at, status)
         VALUES (?, ?, ?, 'planned')`,
        [slot.medication_id, slot.schedule_time_id, atTime(dateISO, slot.hour, slot.minute)],
      );
    }
  });
}

export async function listDosesForDate(
  dateISO: string = dateKey(),
): Promise<DoseWithMedication[]> {
  await ensureDosesForDate(dateISO);
  const db = await getDb();
  return db.getAllAsync<DoseWithMedication>(
    `SELECT d.*, m.name, m.dosage, m.form, m.meal
       FROM doses d
       JOIN medications m ON m.id = d.medication_id
      WHERE d.planned_at >= ? AND d.planned_at < ?
      ORDER BY d.planned_at, m.name COLLATE NOCASE`,
    [`${dateISO}T00:00:00`, `${addDays(dateISO, 1)}T00:00:00`],
  );
}

/**
 * Доза для большой карточки на главном экране: самая ранняя неотмеченная
 * за сегодня. Пропущенные тоже возвращаются — человек мог принять лекарство
 * с опозданием, и отметить это важнее, чем сохранить статистику чистой.
 */
export async function nextActionableDose(): Promise<DoseWithMedication | null> {
  const today = dateKey();
  await ensureDosesForDate(today);
  const db = await getDb();
  const dose = await db.getFirstAsync<DoseWithMedication>(
    `SELECT d.*, m.name, m.dosage, m.form, m.meal
       FROM doses d
       JOIN medications m ON m.id = d.medication_id
      WHERE d.planned_at >= ? AND d.planned_at < ?
        AND d.status IN ('planned', 'missed')
      ORDER BY d.planned_at
      LIMIT 1`,
    [`${today}T00:00:00`, `${addDays(today, 1)}T00:00:00`],
  );
  return dose ?? null;
}

export async function markDose(doseId: number, status: DoseStatus): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE doses SET status = ?, acted_at = ?, synced = 0 WHERE id = ?`,
    [status, status === 'planned' ? null : localISO(), doseId],
  );
}

/**
 * Переводит просроченные дозы в «пропущено». Вызывается при открытии
 * приложения и из фоновой задачи: именно этот переход рождает уведомление
 * родственнику в разделе «Ota-onam».
 *
 * @param graceMinutes сколько ждём подтверждения после времени приёма
 * @returns дозы, которые только что стали пропущенными
 */
export async function markOverdueAsMissed(graceMinutes: number): Promise<DoseWithMedication[]> {
  const db = await getDb();
  const cutoff = localISO(new Date(Date.now() - graceMinutes * 60_000));

  const overdue = await db.getAllAsync<DoseWithMedication>(
    `SELECT d.*, m.name, m.dosage, m.form, m.meal
       FROM doses d
       JOIN medications m ON m.id = d.medication_id
      WHERE d.status = 'planned' AND d.planned_at < ?`,
    [cutoff],
  );
  if (overdue.length === 0) return [];

  await db.runAsync(
    `UPDATE doses SET status = 'missed', synced = 0
      WHERE status = 'planned' AND planned_at < ?`,
    [cutoff],
  );
  return overdue.map((d) => ({ ...d, status: 'missed' as const }));
}

export type DayProgress = { taken: number; total: number };

export async function dayProgress(dateISO: string = dateKey()): Promise<DayProgress> {
  await ensureDosesForDate(dateISO);
  const db = await getDb();
  const row = await db.getFirstAsync<{ taken: number; total: number }>(
    `SELECT SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) AS taken,
            COUNT(*) AS total
       FROM doses
      WHERE planned_at >= ? AND planned_at < ?`,
    [`${dateISO}T00:00:00`, `${addDays(dateISO, 1)}T00:00:00`],
  );
  return { taken: row?.taken ?? 0, total: row?.total ?? 0 };
}

export type DayAdherence = DayProgress & { date: string };

/**
 * Неделя приёма для полоски из презентации: день за днём, принято из сколько.
 * Будущие дни остаются с нулями — это ещё не пропуск.
 */
export async function weekAdherence(endDate: string = dateKey()): Promise<DayAdherence[]> {
  const days: DayAdherence[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(endDate, -i);
    days.push({ date, ...(await dayProgress(date)) });
  }
  return days;
}

/** Доли принятого за период — для карточки «сколько дней подряд». */
export async function adherenceRate(days: number): Promise<number | null> {
  const db = await getDb();
  const from = `${addDays(dateKey(), -(days - 1))}T00:00:00`;
  const row = await db.getFirstAsync<{ taken: number; total: number }>(
    `SELECT SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) AS taken,
            COUNT(*) AS total
       FROM doses
      WHERE planned_at >= ? AND planned_at <= ?`,
    [from, localISO()],
  );
  if (!row?.total) return null;
  return row.taken / row.total;
}

/** Дозы, ожидающие отправки родственнику. */
export async function unsyncedDoses(): Promise<DoseWithMedication[]> {
  const db = await getDb();
  return db.getAllAsync<DoseWithMedication>(
    `SELECT d.*, m.name, m.dosage, m.form, m.meal
       FROM doses d
       JOIN medications m ON m.id = d.medication_id
      WHERE d.synced = 0 AND d.status != 'planned'
      ORDER BY d.planned_at`,
  );
}

export async function markSynced(doseIds: number[]): Promise<void> {
  if (doseIds.length === 0) return;
  const db = await getDb();
  const placeholders = doseIds.map(() => '?').join(',');
  await db.runAsync(`UPDATE doses SET synced = 1 WHERE id IN (${placeholders})`, doseIds);
}
