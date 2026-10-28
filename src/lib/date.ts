/**
 * Время в приложении — всегда местное время пользователя.
 *
 * Даты хранятся как 'YYYY-MM-DD', момент времени — как 'YYYY-MM-DDTHH:mm:ss'
 * БЕЗ суффикса зоны. Это осознанное решение: «таблетка в 8 утра» означает
 * восемь утра там, где человек живёт. При хранении в UTC переезд в другой
 * часовой пояс или перевод времени сдвинул бы напоминания, а границы суток
 * перестали бы совпадать с днём пациента. Строки такого вида ещё и сортируются
 * лексикографически, то есть сравнение в SQL работает само.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' для указанного момента (по умолчанию — сейчас). */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DDTHH:mm:ss' в местном времени. */
export function localISO(d: Date = new Date()): string {
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Разбирает нашу местную строку в Date. new Date(строка) трактовал бы её как UTC. */
export function parseLocalISO(value: string): Date {
  const [datePart, timePart = '00:00:00'] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss = 0] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss);
}

/** Момент конкретного времени приёма в конкретный день. */
export function atTime(dateISO: string, hour: number, minute: number): string {
  return `${dateISO}T${pad(hour)}:${pad(minute)}:00`;
}

/** '08:00' — то, что видит пользователь. */
export function hhmm(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

/** Время суток из нашей строки: '14:00'. */
export function timeOf(value: string): string {
  const d = parseLocalISO(value);
  return hhmm(d.getHours(), d.getMinutes());
}

export function addDays(dateISO: string, days: number): string {
  const d = parseLocalISO(dateISO);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Целых дней между датами; знак показывает направление. */
export function daysBetween(fromISO: string, toISO: string): number {
  const ms = parseLocalISO(toISO).getTime() - parseLocalISO(fromISO).getTime();
  return Math.round(ms / 86_400_000);
}

export function minutesBetween(fromISO: string, toISO: string): number {
  const ms = parseLocalISO(toISO).getTime() - parseLocalISO(fromISO).getTime();
  return Math.round(ms / 60_000);
}

/** День недели в виде ключа перевода: понедельник первый. */
export function dowKey(dateISO: string) {
  const keys = ['dowSun', 'dowMon', 'dowTue', 'dowWed', 'dowThu', 'dowFri', 'dowSat'] as const;
  return keys[parseLocalISO(dateISO).getDay()];
}

/** Длительность сна: 440 минут → { hours: 7, minutes: 20 }. */
export function splitDuration(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
