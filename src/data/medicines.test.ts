import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATALOG, searchCatalog } from './medicines';

/** Что человек набрал → какой препарат обязан найтись первым. */
const CASES: [query: string, expectedId: string][] = [
  // Латиница и кириллица для одного препарата
  ['metfo', 'metformin'],
  ['метфо', 'metformin'],
  ['Metformin', 'metformin'],
  // Торговое название — его часто помнят вместо действующего вещества
  ['глюкофаж', 'metformin'],
  ['siofor', 'metformin'],
  ['omez', 'omeprazole'],
  ['конкор', 'bisoprolol'],
  // Написание на слух: Concor → konkor, c читается как k
  ['konkor', 'bisoprolol'],
  // ts вместо s: kaltsiy → Kalsiy
  ['kaltsiy', 'calcium-d3'],
  ['setirizin', 'cetirizine'],
  ['tsetirizin', 'cetirizine'],
  // x и h взаимозаменяемы
  ['xloropiramin', 'chloropyramine'],
  ['hloropiramin', 'chloropyramine'],
  // Удвоение согласных
  ['alopurinol', 'allopurinol'],
  ['allopurinol', 'allopurinol'],
  // Узбекские апострофы пропущены: «Sunʼiy koʻz yoshi» набирают без них
  ['suniy koz', 'artificial-tears'],
  ['sunʼiy koʻz', 'artificial-tears'],
  // q и k на слух не различаются в заимствованных названиях
  ['kanefron', 'canephron'],
];

test('поиск находит препарат при разных написаниях', () => {
  for (const [query, expectedId] of CASES) {
    const hits = searchCatalog(query, 5);
    assert.ok(hits.length > 0, `«${query}» не нашёл ничего`);
    assert.equal(
      hits[0].entry.id,
      expectedId,
      `«${query}» → ожидали ${expectedId}, получили ${hits[0].entry.id}`,
    );
  }
});

test('короткий и бессмысленный запрос ничего не возвращает', () => {
  assert.equal(searchCatalog('m').length, 0, 'одна буква — слишком широко');
  assert.equal(searchCatalog('').length, 0);
  assert.equal(searchCatalog('щщщ').length, 0);
});

test('совпадение с начала названия идёт выше совпадения в середине', () => {
  const hits = searchCatalog('metformin', 10);
  assert.equal(hits[0].entry.id, 'metformin');
});

test('у каждой записи справочника уникальный id и заполнены поля', () => {
  const seen = new Set<string>();
  for (const e of CATALOG) {
    assert.ok(!seen.has(e.id), `повторяющийся id: ${e.id}`);
    seen.add(e.id);
    assert.ok(e.uz.length > 1, `пустое узбекское название: ${e.id}`);
    assert.ok(e.ru.length > 1, `пустое русское название: ${e.id}`);
    assert.ok(e.strengths.length > 0, `нет дозировок: ${e.id}`);
  }
});
