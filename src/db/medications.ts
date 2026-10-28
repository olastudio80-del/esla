import { getDb } from './index';
import type { Meal, Medication, MedicationRow, ScheduleTimeRow } from './types';

import { dateKey, localISO } from '@/lib/date';

export type MedicationInput = {
  name: string;
  dosage?: string | null;
  form?: string | null;
  meal?: Meal;
  /** null — принимать постоянно. */
  courseDays?: number | null;
  note?: string | null;
  catalogId?: string | null;
  startedOn?: string;
  /** Времена приёма в сутках; пустой список допустим — лекарство «по требованию». */
  times: { hour: number; minute: number }[];
};

export async function listMedications(includeArchived = false): Promise<Medication[]> {
  const db = await getDb();
  const meds = await db.getAllAsync<MedicationRow>(
    `SELECT * FROM medications ${includeArchived ? '' : 'WHERE archived = 0'}
     ORDER BY archived, name COLLATE NOCASE`,
  );
  if (meds.length === 0) return [];

  // Все времена одним запросом вместо запроса на каждое лекарство.
  const times = await db.getAllAsync<ScheduleTimeRow>(
    `SELECT * FROM schedule_times ORDER BY hour, minute`,
  );
  const byMed = new Map<number, ScheduleTimeRow[]>();
  for (const row of times) {
    const list = byMed.get(row.medication_id);
    if (list) list.push(row);
    else byMed.set(row.medication_id, [row]);
  }
  return meds.map((m) => ({ ...m, times: byMed.get(m.id) ?? [] }));
}

export async function getMedication(id: number): Promise<Medication | null> {
  const db = await getDb();
  const med = await db.getFirstAsync<MedicationRow>('SELECT * FROM medications WHERE id = ?', [id]);
  if (!med) return null;
  const times = await db.getAllAsync<ScheduleTimeRow>(
    'SELECT * FROM schedule_times WHERE medication_id = ? ORDER BY hour, minute',
    [id],
  );
  return { ...med, times };
}

export async function createMedication(input: MedicationInput): Promise<number> {
  const db = await getDb();
  let id = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO medications (name, dosage, form, meal, course_days, started_on, note, catalog_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name.trim(),
        input.dosage?.trim() || null,
        input.form ?? null,
        input.meal ?? 'any',
        input.courseDays ?? null,
        input.startedOn ?? dateKey(),
        input.note?.trim() || null,
        input.catalogId ?? null,
        localISO(),
      ],
    );
    id = res.lastInsertRowId;
    await insertTimes(db, id, input.times);
  });
  return id;
}

export async function updateMedication(id: number, input: MedicationInput): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE medications
       SET name = ?, dosage = ?, form = ?, meal = ?, course_days = ?, note = ?, catalog_id = ?
       WHERE id = ?`,
      [
        input.name.trim(),
        input.dosage?.trim() || null,
        input.form ?? null,
        input.meal ?? 'any',
        input.courseDays ?? null,
        input.note?.trim() || null,
        input.catalogId ?? null,
        id,
      ],
    );
    // Времена пересоздаём целиком: расписание короткое, а diff дал бы лишнюю сложность.
    await db.runAsync('DELETE FROM schedule_times WHERE medication_id = ?', [id]);
    await insertTimes(db, id, input.times);
    // Будущие дозы пересоберёт планировщик; прошлые остаются как история приёма.
    await db.runAsync(
      `DELETE FROM doses WHERE medication_id = ? AND status = 'planned' AND planned_at > ?`,
      [id, localISO()],
    );
  });
}

async function insertTimes(
  db: Awaited<ReturnType<typeof getDb>>,
  medicationId: number,
  times: { hour: number; minute: number }[],
) {
  // Дубликаты времён бессмысленны: два уведомления в одну минуту.
  const unique = new Map(times.map((t) => [`${t.hour}:${t.minute}`, t]));
  for (const t of unique.values()) {
    await db.runAsync(
      'INSERT INTO schedule_times (medication_id, hour, minute) VALUES (?, ?, ?)',
      [medicationId, t.hour, t.minute],
    );
  }
}

/** Убирает из списка, но сохраняет историю приёма. */
export async function archiveMedication(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE medications SET archived = 1 WHERE id = ?', [id]);
    await db.runAsync(`DELETE FROM doses WHERE medication_id = ? AND status = 'planned'`, [id]);
  });
}

/** Полное удаление вместе с историей — каскадом по внешним ключам. */
export async function deleteMedication(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM medications WHERE id = ?', [id]);
}

export async function setNotificationId(
  scheduleTimeId: number,
  notificationId: string | null,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE schedule_times SET notification_id = ? WHERE id = ?', [
    notificationId,
    scheduleTimeId,
  ]);
}
