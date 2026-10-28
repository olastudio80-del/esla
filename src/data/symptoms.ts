/**
 * Симптомы для опроса о самочувствии.
 *
 * Поле alarm — не «тяжёлый симптом», а признак состояния, при котором
 * опрос обязан прекратиться и человека нужно направить к врачу или в скорую.
 * Список намеренно короткий и консервативный: приложение не диагностирует,
 * оно распознаёт ситуации, в которых ждать нельзя.
 *
 * Эти же пометки использует голосовой помощник: при alarm-симптоме он
 * прекращает расспросы, говорит обратиться за помощью и ставит отметку,
 * по которой родственник получает уведомление.
 */

export type Symptom = {
  id: string;
  uz: string;
  ru: string;
  /** Требует немедленного обращения к врачу. */
  alarm: boolean;
};

export const SYMPTOMS: Symptom[] = [
  { id: 'headache', uz: 'Bosh ogʻrigʻi', ru: 'Головная боль', alarm: false },
  { id: 'dizziness', uz: 'Bosh aylanishi', ru: 'Головокружение', alarm: false },
  { id: 'weakness', uz: 'Holsizlik', ru: 'Слабость', alarm: false },
  { id: 'nausea', uz: 'Koʻngil aynishi', ru: 'Тошнота', alarm: false },
  { id: 'stomach', uz: 'Qorin ogʻrigʻi', ru: 'Боль в животе', alarm: false },
  { id: 'insomnia', uz: 'Uyqusizlik', ru: 'Бессонница', alarm: false },
  { id: 'swelling', uz: 'Shish', ru: 'Отёки', alarm: false },
  { id: 'rash', uz: 'Toshma', ru: 'Сыпь', alarm: false },
  { id: 'palpitations', uz: 'Yurak tez urishi', ru: 'Учащённое сердцебиение', alarm: false },
  { id: 'pressure', uz: 'Qon bosimi koʻtarildi', ru: 'Повысилось давление', alarm: false },

  // Дальше — состояния, при которых нельзя ждать.
  { id: 'chest-pain', uz: 'Koʻkrak qafasida ogʻriq', ru: 'Боль в груди', alarm: true },
  { id: 'breathless', uz: 'Nafas qisishi', ru: 'Одышка, не хватает воздуха', alarm: true },
  { id: 'confusion', uz: 'Hushim ogʻdi, chalkashlik', ru: 'Спутанность сознания', alarm: true },
  { id: 'bleeding', uz: 'Qon ketishi', ru: 'Кровотечение', alarm: true },
  { id: 'speech', uz: 'Gapirish qiyinlashdi', ru: 'Трудно говорить', alarm: true },
  { id: 'weak-side', uz: 'Qoʻl yoki oyoq kuchsizlandi', ru: 'Слабость в руке или ноге', alarm: true },
];

export function symptomById(id: string): Symptom | undefined {
  return SYMPTOMS.find((s) => s.id === id);
}

export function hasAlarm(ids: string[]): boolean {
  return ids.some((id) => symptomById(id)?.alarm === true);
}

/**
 * Номер скорой помощи в Узбекистане. 103 — скорая, 112 — единый номер.
 * Вынесено в константу: при выходе в другую страну меняется здесь.
 */
export const AMBULANCE_NUMBER = '103';
