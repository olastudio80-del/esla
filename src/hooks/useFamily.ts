import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { cloudConfigured } from '@/features/cloud/client';
import {
  claimInvite,
  ensureProfile,
  fetchPatientAlarms,
  fetchPatientDoses,
  fetchPatientVitals,
  listPatients,
  refreshInviteCode,
  unlinkPatient,
  type Patient,
  type PatientAlarm,
  type PatientDose,
  type PatientVitals,
} from '@/features/cloud/sync';
import { addDays, dateKey, parseLocalISO } from '@/lib/date';
import { usePrefs } from '@/store/prefs';

export type PatientView = {
  patient: Patient;
  doses: PatientDose[];
  vitals: PatientVitals | null;
  alarms: PatientAlarm[];
  /**
   * Всё, что зависит от текущего времени, считается здесь, при загрузке,
   * а не в разметке: вычисление времени во время отрисовки непредсказуемо
   * при повторном проходе и запрещено правилами React.
   */
  todayDoses: PatientDose[];
  takenToday: number;
  missedToday: PatientDose[];
  /** Сутки без единой отправки — повод позвонить, а не ждать. */
  silent: boolean;
  unseenAlarm: PatientAlarm | null;
  /**
   * Лекарства родителя, собранные из присланных доз. Отдельно список
   * лекарств не передаётся: дозы и так содержат название, дозировку и
   * время, а лишнее поле в облаке — лишние данные о здоровье снаружи.
   */
  medicines: { name: string; dosage: string | null; times: string[] }[];
};

/** Собирает лекарства из доз: одно название — одна строка со всеми временами. */
function collectMedicines(doses: PatientDose[]): PatientView['medicines'] {
  const byName = new Map<string, { name: string; dosage: string | null; times: Set<string> }>();
  for (const dose of doses) {
    const key = `${dose.name}|${dose.dosage ?? ''}`;
    const entry = byName.get(key) ?? { name: dose.name, dosage: dose.dosage, times: new Set() };
    entry.times.add(dose.plannedAt.slice(11, 16));
    byName.set(key, entry);
  }
  return [...byName.values()]
    .map((m) => ({ name: m.name, dosage: m.dosage, times: [...m.times].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Собирает производные данные одного родителя на момент загрузки. */
function buildView(
  patient: Patient,
  doses: PatientDose[],
  vitals: PatientVitals | null,
  alarms: PatientAlarm[],
  now: Date,
): PatientView {
  const today = dateKey(now);
  const todayDoses = doses.filter((dose) => dose.plannedAt.slice(0, 10) === today);
  return {
    patient,
    doses,
    vitals,
    alarms,
    todayDoses,
    takenToday: todayDoses.filter((dose) => dose.status === 'taken').length,
    missedToday: todayDoses.filter((dose) => dose.status === 'missed'),
    silent:
      !patient.lastSeenAt || now.getTime() - new Date(patient.lastSeenAt).getTime() > DAY_MS,
    unseenAlarm: alarms.find((alarm) => alarm.seenAt === null) ?? null,
    medicines: collectMedicines(doses),
  };
}

export type Invite = { code: string; expiresAt: string };

/**
 * Раздел «Ota-onam».
 *
 * У экрана две стороны. На телефоне родителя он показывает код приглашения —
 * шесть знаков, которые диктуют детям. На телефоне ребёнка — что происходит
 * у родителей: приём лекарств, показатели браслета и тревожные записи.
 *
 * Облако здесь необязательно: без него приложение работает целиком, поэтому
 * каждая операция молча возвращает пустоту вместо ошибки, а экран объясняет
 * словами, что связь не настроена.
 */
export function useFamily() {
  const { prefs, set } = usePrefs();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [views, setViews] = useState<PatientView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!cloudConfigured) {
      setLoading(false);
      return;
    }
    await ensureProfile(prefs.role, prefs.patientName || null);

    if (prefs.role === 'relative') {
      const patients = await listPatients();
      // Неделя назад: достаточно, чтобы увидеть пропуски, и не грузит лишнего.
      const since = parseLocalISO(`${addDays(dateKey(), -7)}T00:00:00`).toISOString();
      const now = new Date();
      const loaded = await Promise.all(
        patients.map(async (patient) =>
          buildView(
            patient,
            await fetchPatientDoses(patient.id, since),
            await fetchPatientVitals(patient.id),
            await fetchPatientAlarms(patient.id),
            now,
          ),
        ),
      );
      setViews(loaded);
    }
    setLoading(false);
  }, [prefs.role, prefs.patientName]);

  useFocusEffect(
    useCallback(() => {
      reload().catch((error) => {
        console.warn('[esla] раздел «родители» не загрузился', error);
        setLoading(false);
      });
    }, [reload]),
  );

  /** Выдать родителю новый код. Старый сразу перестаёт работать. */
  const createInvite = useCallback(async () => {
    setBusy(true);
    try {
      setInvite(await refreshInviteCode());
    } finally {
      setBusy(false);
    }
  }, []);

  /** Ребёнок вводит код родителя. */
  const addPatient = useCallback(
    async (code: string, relation: string | null) => {
      setBusy(true);
      try {
        const result = await claimInvite(code, relation);
        if (result.ok) await reload();
        return result;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const removePatient = useCallback(
    async (patientId: string) => {
      await unlinkPatient(patientId);
      await reload();
    },
    [reload],
  );

  const setRole = useCallback(
    (role: 'patient' | 'relative') => {
      set('role', role);
      setInvite(null);
      setViews([]);
      setLoading(true);
    },
    [set],
  );

  // Выбранный родитель: сохранённый, а если его больше нет — первый.
  const selected =
    views.find((v) => v.patient.id === prefs.selectedPatientId) ?? views[0] ?? null;

  const select = useCallback(
    (patientId: string) => set('selectedPatientId', patientId),
    [set],
  );

  return {
    configured: cloudConfigured,
    selected,
    select,
    role: prefs.role,
    setRole,
    invite,
    createInvite,
    views,
    addPatient,
    removePatient,
    loading,
    busy,
    reload,
  };
}
