import { supabase } from './client';

import { markCheckinsSynced, unsyncedAlarms } from '@/db/checkins';
import { listDosesForDate, markSynced, unsyncedDoses } from '@/db/doses';
import type { HealthSnapshot } from '@/features/health';
import { parseLocalISO } from '@/lib/date';

/**
 * Обмен с облаком для раздела «Ota-onam».
 *
 * Наверх уходит только то, что ребёнок видит на экране: названия лекарств
 * со временем приёма, последние показатели браслета и тревожные записи.
 * Анализы, заключения, диагнозы, аллергии и обычные записи самочувствия
 * остаются на телефоне.
 *
 * Любая ошибка здесь — не повод ломать экран: связь телефонов это
 * дополнение, а напоминания о лекарствах работают без неё.
 */

export type CloudError = 'not-configured' | 'no-session' | 'invite-not-found' | 'failed';

export type Patient = {
  id: string;
  name: string | null;
  relation: string | null;
  /**
   * Когда телефон родителя последний раз выходил на связь.
   * Долгое молчание — первый сигнал в лестнице реагирования: ребёнок
   * видит его раньше, чем что-либо успеет случиться.
   */
  lastSeenAt: string | null;
};

export type PatientDose = {
  localId: number;
  name: string;
  dosage: string | null;
  plannedAt: string;
  status: 'planned' | 'taken' | 'missed' | 'skipped';
};

export type PatientVitals = {
  heartRate: number | null;
  heartRateAt: string | null;
  steps: number | null;
  stepsAt: string | null;
  sleepMinutes: number | null;
  sleepAt: string | null;
};

export type PatientAlarm = {
  id: number;
  symptoms: string[];
  note: string | null;
  createdAt: string;
  seenAt: string | null;
};

/** Входит без регистрации. Аккаунт привязан к устройству. */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('[esla] вход не удался', error.message);
    return null;
  }
  return created.user?.id ?? null;
}

/** Заводит или обновляет профиль этого устройства. */
export async function ensureProfile(
  role: 'patient' | 'relative',
  displayName: string | null,
): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSession();
  if (!userId) return false;

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, role, display_name: displayName, updated_at: new Date().toISOString() });

  if (error) {
    console.warn('[esla] профиль не сохранён', error.message);
    return false;
  }
  return true;
}

/** Новый код приглашения для родителя. Старый сразу перестаёт работать. */
export async function refreshInviteCode(): Promise<{ code: string; expiresAt: string } | null> {
  if (!supabase) return null;
  if (!(await ensureSession())) return null;

  const { data, error } = await supabase.rpc('refresh_invite_code');
  if (error || !data?.[0]) {
    console.warn('[esla] код приглашения не выдан', error?.message);
    return null;
  }
  return { code: data[0].code, expiresAt: data[0].expires_at };
}

/** Ребёнок вводит код родителя. Код одноразовый. */
export async function claimInvite(
  code: string,
  relation: string | null,
): Promise<{ ok: true; patientId: string } | { ok: false; error: CloudError }> {
  if (!supabase) return { ok: false, error: 'not-configured' };
  if (!(await ensureSession())) return { ok: false, error: 'no-session' };

  const { data, error } = await supabase.rpc('claim_invite', { code, relation });
  if (error) {
    // Неверный или просроченный код — обычная ситуация, а не сбой.
    const notFound = error.message.includes('invite_not_found');
    return { ok: false, error: notFound ? 'invite-not-found' : 'failed' };
  }
  return { ok: true, patientId: data as string };
}

/** Отправляет наверх состояние пациента. Вызывается после отметки приёма. */
export async function pushPatientState(vitals: HealthSnapshot | null): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSession();
  if (!userId) return;

  try {
    await pushDoses(userId);
    await pushAlarms(userId);
    if (vitals) await pushVitals(userId, vitals);
    // Отметка «был на связи» — даже если отправлять было нечего.
    await supabase.rpc('touch_last_seen');
  } catch (error) {
    console.warn('[esla] не удалось отправить состояние', error);
  }
}

async function pushDoses(userId: string): Promise<void> {
  if (!supabase) return;
  // Отправляем и отмеченные дозы, и сегодняшний план: ребёнок должен
  // видеть не только пропуски, но и то, что приём ещё впереди.
  const [changed, today] = await Promise.all([unsyncedDoses(), listDosesForDate()]);
  const byLocalId = new Map<number, (typeof today)[number]>();
  for (const dose of [...today, ...changed]) byLocalId.set(dose.id, dose);
  if (byLocalId.size === 0) return;

  const rows = [...byLocalId.values()].map((dose) => ({
    patient_id: userId,
    local_id: dose.id,
    medication_name: dose.name,
    dosage: dose.dosage,
    planned_at: parseLocalISO(dose.planned_at).toISOString(),
    status: dose.status,
    acted_at: dose.acted_at ? parseLocalISO(dose.acted_at).toISOString() : null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('shared_doses').upsert(rows, {
    onConflict: 'patient_id,local_id',
  });
  if (error) throw error;

  await markSynced(changed.map((dose) => dose.id));
}

async function pushAlarms(userId: string): Promise<void> {
  if (!supabase) return;
  const alarms = await unsyncedAlarms();
  if (alarms.length === 0) return;

  const { error } = await supabase.from('shared_alarms').upsert(
    alarms.map((alarm) => ({
      patient_id: userId,
      local_id: alarm.id,
      symptoms: alarm.symptoms,
      note: alarm.note,
      created_at: parseLocalISO(alarm.created_at).toISOString(),
    })),
    { onConflict: 'patient_id,local_id' },
  );
  if (error) throw error;

  await markCheckinsSynced(alarms.map((alarm) => alarm.id));
}

async function pushVitals(userId: string, vitals: HealthSnapshot): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('shared_vitals').upsert({
    patient_id: userId,
    heart_rate: vitals.heartRate?.value ?? null,
    heart_rate_at: vitals.heartRate ? parseLocalISO(vitals.heartRate.measuredAt).toISOString() : null,
    steps: vitals.steps?.value ?? null,
    steps_at: vitals.steps ? parseLocalISO(vitals.steps.measuredAt).toISOString() : null,
    sleep_minutes: vitals.sleepMinutes?.value ?? null,
    sleep_at: vitals.sleepMinutes ? parseLocalISO(vitals.sleepMinutes.measuredAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Кого наблюдает это устройство. */
export async function listPatients(): Promise<Patient[]> {
  if (!supabase) return [];
  const userId = await ensureSession();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('links')
    .select('relation, patient:patient_id (id, display_name, last_seen_at)')
    .eq('relative_id', userId);

  if (error) {
    console.warn('[esla] список родителей не получен', error.message);
    return [];
  }

  type Row = {
    relation: string | null;
    patient: { id: string; display_name: string | null; last_seen_at: string | null } | null;
  };
  return (data as unknown as Row[])
    .filter((row) => row.patient !== null)
    .map((row) => ({
      id: row.patient!.id,
      name: row.patient!.display_name,
      relation: row.relation,
      lastSeenAt: row.patient!.last_seen_at,
    }));
}

export async function fetchPatientDoses(patientId: string, sinceISO: string): Promise<PatientDose[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('shared_doses')
    .select('local_id, medication_name, dosage, planned_at, status')
    .eq('patient_id', patientId)
    .gte('planned_at', sinceISO)
    .order('planned_at');

  if (error) {
    console.warn('[esla] приём лекарств не получен', error.message);
    return [];
  }
  return data.map((row) => ({
    localId: row.local_id as number,
    name: row.medication_name as string,
    dosage: row.dosage as string | null,
    plannedAt: row.planned_at as string,
    status: row.status as PatientDose['status'],
  }));
}

export async function fetchPatientVitals(patientId: string): Promise<PatientVitals | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('shared_vitals')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    heartRate: data.heart_rate as number | null,
    heartRateAt: data.heart_rate_at as string | null,
    steps: data.steps as number | null,
    stepsAt: data.steps_at as string | null,
    sleepMinutes: data.sleep_minutes as number | null,
    sleepAt: data.sleep_at as string | null,
  };
}

export async function fetchPatientAlarms(patientId: string): Promise<PatientAlarm[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('shared_alarms')
    .select('id, symptoms, note, created_at, seen_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return [];
  return data.map((row) => ({
    id: row.id as number,
    symptoms: (row.symptoms as string[]) ?? [],
    note: row.note as string | null,
    createdAt: row.created_at as string,
    seenAt: row.seen_at as string | null,
  }));
}

/** Разорвать связь. Доступно обеим сторонам. */
export async function unlinkPatient(patientId: string): Promise<boolean> {
  if (!supabase) return false;
  const userId = await ensureSession();
  if (!userId) return false;
  const { error } = await supabase
    .from('links')
    .delete()
    .eq('patient_id', patientId)
    .eq('relative_id', userId);
  return !error;
}
