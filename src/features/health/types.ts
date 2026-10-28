/**
 * Единый интерфейс к данным браслета. Реализации платформенные:
 *
 *   Android — Health Connect. Браслет НЕ отдаёт данные напрямую: он
 *   синхронизируется со своим приложением (Mi Fitness, Zepp, Samsung Health,
 *   Fitbit, Garmin), а оно пишет в Health Connect, откуда читаем мы.
 *
 *   iOS — HealthKit (приложение «Здоровье»). Apple Watch пишет туда пульс,
 *   сон и шаги сама.
 *
 * ВАЖНО ПРО ВРЕМЯ: это не живой пульс. Это последнее значение, которое
 * приложение браслета успело синхронизировать — иногда минуты назад, иногда
 * часы. Поэтому у каждого показателя обязательна метка времени, и интерфейс
 * показывает её рядом со значением: «72 уд/мин · 12 мин назад». Изображать
 * реальное время было бы обманом в медицинском приложении.
 */

export type HealthState =
  /** Разрешения есть, можно читать. */
  | 'ready'
  /** Нужно спросить разрешение у пользователя. */
  | 'needs-permission'
  /** Health Connect не установлен (только Android). */
  | 'provider-missing'
  /** Health Connect требует обновления. */
  | 'provider-update'
  /** Платформа не поддерживает чтение данных о здоровье. */
  | 'unsupported';

export type VitalSample = {
  value: number;
  /** Когда показатель измерен, в местном времени. */
  measuredAt: string;
  /** Приложение-источник: помогает понять, какой браслет пишет данные. */
  source?: string | null;
};

export type HealthSnapshot = {
  /** Последнее измерение пульса. */
  heartRate: VitalSample | null;
  /** Шаги за сегодня. */
  steps: VitalSample | null;
  /** Сон за прошлую ночь, в минутах. */
  sleepMinutes: VitalSample | null;
};

export const EMPTY_SNAPSHOT: HealthSnapshot = {
  heartRate: null,
  steps: null,
  sleepMinutes: null,
};

export type HealthProvider = {
  /** Что именно читаем — для честной подписи в интерфейсе. */
  readonly kind: 'health-connect' | 'healthkit' | 'none';
  /** Проверить доступность без запроса разрешений. */
  check(): Promise<HealthState>;
  /** Запросить разрешения. true — дали. */
  request(): Promise<boolean>;
  /** Открыть системные настройки источника данных. */
  openSettings(): Promise<void>;
  /** Прочитать показатели. Пустые поля означают «данных нет». */
  read(): Promise<HealthSnapshot>;
};
