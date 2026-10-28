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
};

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
      const loaded = await Promise.all(
        patients.map(async (patient) => ({
          patient,
          doses: await fetchPatientDoses(patient.id, since),
          vitals: await fetchPatientVitals(patient.id),
          alarms: await fetchPatientAlarms(patient.id),
        })),
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

  return {
    configured: cloudConfigured,
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
