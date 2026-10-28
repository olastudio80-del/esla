// Собирает итоговый справочник из выгрузки реестра.
//
// Ключи поиска считаются той же функцией fold, что работает в приложении:
// вторая реализация неизбежно разошлась бы с первой, и поиск перестал бы
// находить то, что лежит в данных, — молча.
//
// МНН и дозировки повторяются тысячами раз, поэтому вынесены в таблицы,
// а строки ссылаются на них номерами: файл едет в APK и разбирается
// на телефоне, каждая сотня килобайт здесь — это время запуска поиска.
import { readFileSync, writeFileSync } from 'node:fs';

import { fold } from '../../src/lib/text';

type Extracted = { name: string; inn: string; form: string; strengths: string[] };

const items: Extracted[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));

/** «40мг» и «40 мг» — одна и та же дозировка. */
function normalizeStrength(value: string): string {
  return value
    .replace(/(\d)\s*(мг|мл|мкг|г|л|ЕД|МЕ|%)/gi, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

const inns: string[] = [];
const innIndex = new Map<string, number>();
const foldedInns: string[] = [];

const strengths: string[] = [];
const strengthIndex = new Map<string, number>();

const forms: string[] = [];
const formIndex = new Map<string, number>();

function intern(
  value: string,
  table: string[],
  index: Map<string, number>,
): number {
  const existing = index.get(value);
  if (existing !== undefined) return existing;
  const next = table.length;
  table.push(value);
  index.set(value, next);
  return next;
}

const rows = items.map((item) => {
  const inn = intern(item.inn, inns, innIndex);
  if (foldedInns.length <= inn) foldedInns[inn] = fold(item.inn);

  const form = intern(item.form, forms, formIndex);
  const doses = [...new Set(item.strengths.map(normalizeStrength))]
    .filter(Boolean)
    .map((s) => intern(s, strengths, strengthIndex));

  return [item.name, inn, form, doses, fold(item.name)];
});

const payload = { inns, foldedInns, forms, strengths, rows };
writeFileSync(process.argv[3], JSON.stringify(payload), 'utf8');

console.log('позиций:', rows.length);
console.log('МНН:', inns.length, '· форм:', forms.length, '· дозировок:', strengths.length);
console.log('размер:', Math.round(readFileSync(process.argv[3]).length / 1024), 'КБ');
console.log('пример строки:', JSON.stringify(rows[0]));
