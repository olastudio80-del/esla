import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  atTime,
  dateKey,
  daysBetween,
  dowKey,
  hhmm,
  localISO,
  minutesBetween,
  parseLocalISO,
  splitDuration,
  timeOf,
} from './date';

test('dateKey и localISO дают местное время, а не UTC', () => {
  // 1 января 2026, 00:30 по местному времени.
  const d = new Date(2026, 0, 1, 0, 30, 0);
  assert.equal(dateKey(d), '2026-01-01');
  assert.equal(localISO(d), '2026-01-01T00:30:00');
  // Главное свойство: полночь по местному времени остаётся тем же днём.
  // При хранении в UTC в положительных зонах дата уехала бы на 31 декабря.
});

test('parseLocalISO обратен localISO', () => {
  const original = new Date(2026, 9, 28, 14, 5, 9);
  const parsed = parseLocalISO(localISO(original));
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 9);
  assert.equal(parsed.getDate(), 28);
  assert.equal(parsed.getHours(), 14);
  assert.equal(parsed.getMinutes(), 5);
});

test('parseLocalISO не трактует строку как UTC', () => {
  const parsed = parseLocalISO('2026-06-15T08:00:00');
  assert.equal(parsed.getHours(), 8, 'восемь утра должно остаться восемью утра');
});

test('atTime собирает момент приёма с ведущими нулями', () => {
  assert.equal(atTime('2026-03-05', 8, 0), '2026-03-05T08:00:00');
  assert.equal(atTime('2026-03-05', 14, 30), '2026-03-05T14:30:00');
  assert.equal(atTime('2026-03-05', 0, 5), '2026-03-05T00:05:00');
});

test('строки моментов сортируются лексикографически по времени', () => {
  const times = [
    atTime('2026-03-05', 20, 0),
    atTime('2026-03-05', 8, 0),
    atTime('2026-03-04', 23, 0),
    atTime('2026-03-05', 14, 0),
  ];
  assert.deepEqual([...times].sort(), [
    '2026-03-04T23:00:00',
    '2026-03-05T08:00:00',
    '2026-03-05T14:00:00',
    '2026-03-05T20:00:00',
  ]);
});

test('addDays переходит через конец месяца и года', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  // 2028 — високосный
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('курс из 30 дней заканчивается на 30-й день, а не на 31-й', () => {
  const start = '2026-10-28';
  const end = addDays(start, 30 - 1);
  assert.equal(end, '2026-11-26');
  assert.equal(daysBetween(start, end), 29);
});

test('daysBetween и minutesBetween считают со знаком', () => {
  assert.equal(daysBetween('2026-05-01', '2026-05-04'), 3);
  assert.equal(daysBetween('2026-05-04', '2026-05-01'), -3);
  assert.equal(minutesBetween('2026-05-01T08:00:00', '2026-05-01T08:45:00'), 45);
  assert.equal(minutesBetween('2026-05-01T09:00:00', '2026-05-01T08:00:00'), -60);
});

test('hhmm и timeOf показывают время как в интерфейсе', () => {
  assert.equal(hhmm(8, 0), '08:00');
  assert.equal(hhmm(14, 5), '14:05');
  assert.equal(timeOf('2026-10-28T20:00:00'), '20:00');
});

test('dowKey возвращает ключ перевода для дня недели', () => {
  // 28 октября 2026 — среда.
  assert.equal(dowKey('2026-10-28'), 'dowWed');
  assert.equal(dowKey('2026-11-01'), 'dowSun');
});

test('splitDuration разбивает сон на часы и минуты', () => {
  assert.deepEqual(splitDuration(440), { hours: 7, minutes: 20 });
  assert.deepEqual(splitDuration(60), { hours: 1, minutes: 0 });
  assert.deepEqual(splitDuration(45), { hours: 0, minutes: 45 });
  assert.deepEqual(splitDuration(-5), { hours: 0, minutes: 0 }, 'отрицательное время — ноль');
});
