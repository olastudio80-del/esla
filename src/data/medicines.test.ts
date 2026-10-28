import assert from 'node:assert/strict';
import { test } from 'node:test';

import { catalogSize, searchCatalog } from './medicines';

/** Первый найденный препарат для запроса. */
function first(query: string) {
  const hits = searchCatalog(query, 5);
  assert.ok(hits.length > 0, `«${query}» не нашёл ничего`);
  return hits[0].entry;
}

test('в справочнике лежит выгрузка реестра целиком', () => {
  assert.ok(catalogSize() > 8000, `позиций всего ${catalogSize()}`);
});

test('кириллица и латиница находят одно и то же', () => {
  for (const [cyr, lat] of [
    ['метформин', 'metformin'],
    ['амлодипин', 'amlodipin'],
    ['конкор', 'konkor'],
    ['омез', 'omez'],
  ]) {
    assert.equal(
      first(cyr).name,
      first(lat).name,
      `«${cyr}» и «${lat}» должны найти один препарат`,
    );
  }
});

test('торговое название находит действующее вещество', () => {
  // Человек переписывает с коробки торговое название и не знает МНН.
  assert.equal(first('конкор').inn, 'бисопролол');
  assert.equal(first('омез').inn, 'омепразол');
  assert.equal(first('диротон').inn, 'лизиноприл');
  assert.equal(first('вентолин').inn, 'сальбутамол');
});

test('дефисы и пробелы при наборе не обязательны', () => {
  // В реестре «НО-ШПА®», а печатают как придётся.
  for (const query of ['но-шпа', 'ношпа', 'noshpa', 'НО ШПА']) {
    assert.equal(first(query).inn, 'дротаверин', `«${query}»`);
  }
  assert.equal(first('лизиноприл гуфик').name, 'ЛИЗИНОПРИЛ-GUFIC');
});

test('препарат, названный по веществу, идёт раньше похожих марок', () => {
  // «Метформин» человек узнаёт, «МЕТФОКСИН» — нет.
  assert.equal(first('метфо').name, 'Метформин');
  assert.equal(first('метформин').name, 'Метформин');
});

test('у найденного есть форма выпуска и дозировки', () => {
  const entry = first('метформин');
  assert.equal(entry.form, 'tablet');
  assert.ok(entry.strengths.length > 0, 'нет дозировок');
  assert.ok(
    entry.strengths.every((s) => /\d/.test(s)),
    `в дозировках нет чисел: ${entry.strengths.join(', ')}`,
  );
});

test('короткий и бессмысленный запрос ничего не возвращает', () => {
  assert.equal(searchCatalog('м').length, 0, 'одна буква — слишком широко');
  assert.equal(searchCatalog('').length, 0);
  assert.equal(searchCatalog('щщщщ').length, 0);
});

test('выдача не длиннее запрошенного', () => {
  // «метформин» есть у сотни производителей — экран не должен ими залиться.
  assert.ok(searchCatalog('метформин', 6).length <= 6);
  assert.ok(searchCatalog('а', 6).length <= 6);
});

test('данные справочника целы', () => {
  const forms = new Set([
    'tablet', 'capsule', 'syrup', 'injection', 'drops', 'ointment', 'powder',
    'spray', 'inhaler', 'patch', 'suppository', 'suspension', 'solution', 'other',
  ]);
  // Проверяем выборку запросов по разным буквам, а не весь файл:
  // тест должен ловить порчу данных, а не занимать минуту.
  for (const query of ['ме', 'ам', 'ли', 'це', 'ин', 'па', 'ка', 'но']) {
    for (const { entry } of searchCatalog(query, 20)) {
      assert.ok(entry.name.trim().length > 0, 'пустое название');
      assert.ok(forms.has(entry.form), `неизвестная форма: ${entry.form}`);
      assert.ok(Array.isArray(entry.strengths), 'дозировки не список');
    }
  }
});
