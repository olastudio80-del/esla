import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { usePrefs } from '@/store/prefs';
import { type MotionLevel } from '@/theme/tokens';

/**
 * Сколько движения показывать прямо сейчас.
 *
 * Два источника: настройка внутри приложения и системная «уменьшить
 * движение». Системная всегда сильнее — если человек отключил анимации
 * во всём телефоне, приложение не вправе решать за него иначе.
 *
 * Правило, по которому здесь всё построено: движение не задерживает
 * нажатие и не двигает то, во что человек целится. Для пожилых рук
 * промах по кнопке «Ichdim» — это незафиксированный приём лекарства.
 */
export function useMotion(): {
  level: MotionLevel;
  /** Постоянное фоновое движение форм. */
  ambient: boolean;
  /** Появление элементов при открытии экрана. */
  entrance: boolean;
} {
  const { prefs } = usePrefs();
  const [systemReduced, setSystemReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setSystemReduced(value);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReduced,
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  // Системная настройка только ужесточает выбор пользователя, не смягчает.
  const level: MotionLevel =
    systemReduced && prefs.motion === 'full' ? 'reduced' : prefs.motion;

  return {
    level,
    ambient: level === 'full',
    entrance: level !== 'off',
  };
}
