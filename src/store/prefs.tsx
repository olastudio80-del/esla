import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { MotionLevel, TextSize } from '@/theme/tokens';

export type Lang = 'uz' | 'ru';
export type Role = 'patient' | 'relative';

export type Prefs = {
  lang: Lang;
  textSize: TextSize;
  /** Имя в приветствии: «Assalomu alaykum, Karim bobo». */
  patientName: string;
  birthYear: number | null;
  /** Кто держит этот телефон: пациент или его родственник. */
  role: Role;
  /** На сколько откладывает кнопка «напомнить позже». */
  snoozeMinutes: number;
  /** Через сколько неподтверждённая доза считается пропущенной. */
  missedAfterMinutes: number;
  /** Озвучивать ответы помощника голосом. */
  voiceEnabled: boolean;
  /**
   * Более жирное начертание текста. Для слабого зрения это работает не хуже
   * увеличения размера: толще штрих — выше различимость букв, а разметка
   * при этом не разъезжается.
   */
  boldText: boolean;
  /**
   * Сколько движения в интерфейсе.
   *
   * «Полное» — живые формы и переходы из презентации. «Меньше» оставляет
   * только появление элементов, без постоянного фонового движения.
   * «Выключено» убирает всё: для тех, кого движение отвлекает или
   * укачивает, и для старых телефонов, где оно подтормаживает.
   */
  motion: MotionLevel;
  /**
   * Какого из родителей смотрит родственник. Общий для всех его экранов:
   * иначе «Holat» показывал бы отца, а «Dorilar» — мать.
   */
  selectedPatientId: string | null;
  onboarded: boolean;
};

const KEY = 'esla.prefs.v1';

/** Язык телефона определяет язык интерфейса; всё незнакомое — узбекский. */
function detectLang(): Lang {
  const tags = getLocales().map((l) => l.languageCode?.toLowerCase());
  if (tags.includes('ru')) return 'ru';
  return 'uz';
}

const fallback: Prefs = {
  lang: 'uz',
  textSize: 'normal',
  patientName: '',
  birthYear: null,
  role: 'patient',
  snoozeMinutes: 10,
  missedAfterMinutes: 30,
  voiceEnabled: true,
  boldText: false,
  motion: 'full',
  selectedPatientId: null,
  onboarded: false,
};

type Ctx = {
  prefs: Prefs;
  /** Настройки ещё читаются с диска — не показывать интерфейс. */
  loading: boolean;
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
};

const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: PropsWithChildren) {
  const [prefs, setPrefs] = useState<Prefs>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      let stored: Partial<Prefs> | null = null;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) stored = JSON.parse(raw) as Partial<Prefs>;
      } catch {
        // Повреждённые настройки не должны мешать запуску: берём значения по умолчанию.
      }
      if (!alive) return;
      setPrefs({ ...fallback, lang: stored?.lang ?? detectLang(), ...stored });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const set = useCallback<Ctx['set']>((key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      // Запись в фоне: интерфейс не ждёт диск.
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, loading, set }), [prefs, loading, set]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs вызван вне PrefsProvider');
  return ctx;
}
