import { supabase } from './client';

import { markCheckinsSynced, unsyncedAlarms } from '@/db/checkins';
import { listDosesForDate, markSynced, unsyncedDoses } from '@/db/doses';
import type { HealthSnapshot } from '@/features/health';
import { addDays, dateKey, parseLocalISO } from '@/lib/date';

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
    .from('esla_profiles')
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

  const { data, error } = await supabase.rpc('esla_refresh_invite_code');
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

  const { data, error } = await supabase.rpc('esla_claim_invite', { code, relation });
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
    await supabase.rpc('esla_touch_last_seen');
  } catch (error) {
    console.warn('[esla] не удалось отправить состояние', error);
  }
}

/**
 * На сколько дней вперёд уходит план приёма.
 *
 * Не только сегодня — иначе сервер узнавал бы о дозе ровно в тот момент,
 * когда человек её отмечает, и не смог бы заметить, что доза осталась
 * неотмеченной. А заметить это должен именно сервер: телефон человека,
 * который перестал открывать приложение, ничего никому не скажет.
 */
const PLAN_DAYS_AHEAD = 3;

async function pushDoses(userId: string): Promise<void> {
  if (!supabase) return;
  // Отправляем отмеченные дозы и план на несколько дней вперёд: ребёнок
  // должен видеть не только пропуски, но и то, что приём ещё впереди.
  const days = Array.from({ length: PLAN_DAYS_AHEAD }, (_, i) => addDays(dateKey(), i));
  const [changed, ...plan] = await Promise.all([
    unsyncedDoses(),
    ...days.map((day) => listDosesForDate(day)),
  ]);

  const byLocalId = new Map<number, (typeof changed)[number]>();
  for (const dose of [...plan.flat(), ...changed]) byLocalId.set(dose.id, dose);
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

  const { error } = await supabase.from('esla_shared_doses').upsert(rows, {
    onConflict: 'patient_id,local_id',
  });
  if (error) throw error;

  await markSynced(changed.map((dose) => dose.id));
}

async function pushAlarms(userId: string): Promise<void> {
  if (!supabase) return;
  const alarms = await unsyncedAlarms();
  if (alarms.length === 0) return;

  const { error } = await supabase.from('esla_shared_alarms').upsert(
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
  const { error } = await supabase.from('esla_shared_vitals').upsert({
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

  // Два запроса вместо связанной выборки: у представлений нет внешних
  // ключей, и выводить связь автоматически по ним нельзя.
  const { data: links, error: linksError } = await supabase
    .from('esla_links')
    .select('patient_id, relation')
    .eq('relative_id', userId);

  if (linksError) {
    console.warn('[esla] список родителей не получен', linksError.message);
    return [];
  }
  if (!links || links.length === 0) return [];

  const ids = links.map((row) => row.patient_id as string);
  const { data: profiles, error: profilesError } = await supabase
    .from('esla_profiles')
    .select('id, display_name, last_seen_at')
    .in('id', ids);

  if (profilesError) {
    console.warn('[esla] профили родителей не получены', profilesError.message);
    return [];
  }

  const byId = new Map(
    (profiles ?? []).map((row) => [
      row.id as string,
      {
        name: row.display_name as string | null,
        lastSeenAt: row.last_seen_at as string | null,
      },
    ]),
  );

  return links
    .filter((row) => byId.has(row.patient_id as string))
    .map((row) => {
      const profile = byId.get(row.patient_id as string)!;
      return {
        id: row.patient_id as string,
        name: profile.name,
        relation: row.relation as string | null,
        lastSeenAt: profile.lastSeenAt,
      };
    });
}

export async function fetchPatientDoses(patientId: string, sinceISO: string): Promise<PatientDose[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('esla_shared_doses')
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
    .from('esla_shared_vitals')
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
    .from('esla_shared_alarms')
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
    .from('esla_links')
    .delete()
    .eq('patient_id', patientId)
    .eq('relative_id', userId);
  return !error;
}
