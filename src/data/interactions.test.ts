import assert from 'node:assert/strict';
import { test } from 'node:test';

import { INTERACTIONS, findInteractions } from './interactions';

const med = (name: string, inn: string | null) => ({ name, inn });

test('известное опасное сочетание находится', () => {
  const found = findInteractions([
    med('Варфарин', 'варфарин'),
    med('Диклофенак', 'диклофенак'),
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0].rule.id, 'warfarin-nsaid');
  assert.equal(found[0].rule.severity, 'serious');
});

test('порядок добавления лекарств не важен', () => {
  const forward = findInteractions([med('А', 'варфарин'), med('Б', 'ибупрофен')]);
  const backward = findInteractions([med('Б', 'ибупрофен'), med('А', 'варфарин')]);
  assert.equal(forward.length, 1);
  assert.equal(backward.length, 1);
  assert.equal(forward[0].rule.id, backward[0].rule.id);
});

test('безопасное сочетание не вызывает тревоги', () => {
  const found = findInteractions([
    med('Метформин', 'метформин'),
    med('Левотироксин', 'левотироксин натрия'),
  ]);
  assert.equal(found.length, 0);
});

test('лекарства без действующего вещества в проверку не попадают', () => {
  // Вписанные вручную — у них нет МНН, и молчание здесь не означает «безопасно».
  const found = findInteractions([med('Варфарин', null), med('Диклофенак', null)]);
  assert.equal(found.length, 0);
});

test('комбинированный препарат разбирается по составляющим', () => {
  const found = findInteractions([
    med('Варфарин', 'варфарин'),
    med('Комбинация', 'парацетамол + ибупрофен'),
  ]);
  assert.equal(found.length, 1, 'ибупрофен внутри комбинации должен сработать');
});

test('одно и то же сочетание не повторяется дважды', () => {
  const found = findInteractions([
    med('Варфарин', 'варфарин'),
    med('Диклофенак', 'диклофенак'),
    med('Варфарин', 'варфарин'),
  ]);
  assert.equal(found.length, 1);
});

test('серьёзные предупреждения идут первыми', () => {
  const found = findInteractions([
    med('Лизиноприл', 'лизиноприл'),
    med('Ибупрофен', 'ибупрофен'),
    med('Спиронолактон', 'спиронолактон'),
  ]);
  assert.ok(found.length >= 2, `найдено ${found.length}`);
  assert.equal(found[0].rule.severity, 'serious');
});

test('три лекарства дают все попарные сочетания', () => {
  const found = findInteractions([
    med('Варфарин', 'варфарин'),
    med('Диклофенак', 'диклофенак'),
    med('Амиодарон', 'амиодарон'),
  ]);
  const ids = found.map((f) => f.rule.id).sort();
  assert.deepEqual(ids, ['warfarin-amiodarone', 'warfarin-nsaid']);
});

test('правила описаны на обоих языках и ничего не запрещают', () => {
  for (const rule of INTERACTIONS) {
    assert.ok(rule.uz.length > 10, `нет узбекского текста: ${rule.id}`);
    assert.ok(rule.ru.length > 10, `нет русского текста: ${rule.id}`);
    // Приложение не отменяет назначения врача: формулировок-запретов быть не должно.
    assert.ok(
      !/нельзя|запрещ|прекрат|отмен/i.test(rule.ru),
      `правило ${rule.id} формулирует запрет вместо совета обсудить`,
    );
  }
});

test('у правил уникальные идентификаторы', () => {
  const ids = INTERACTIONS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});
