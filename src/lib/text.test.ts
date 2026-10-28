import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fold, matchSpoken } from './text';

import { FEELING_PHRASES, NO_PHRASES, SYMPTOM_PHRASES, YES_PHRASES } from '@/data/answers';

test('fold сводит кириллицу и латиницу к одной форме', () => {
  assert.equal(fold('Метформин'), fold('Metformin'));
  assert.equal(fold('Конкор'), fold('Konkor'));
  assert.equal(fold('Хлоропирамин'), fold('Xloropiramin'));
  // Латинское международное написание должно находить русское и узбекское:
  // в рецептах встречаются все три.
  assert.equal(fold('Celecoxib'), fold('Целекоксиб'));
  assert.equal(fold('Celecoxib'), fold('Selekoksib'));
  assert.equal(fold('Ciprofloxacin'), fold('Ципрофлоксацин'));
});

test('fold не различает написания, которые слышатся одинаково', () => {
  assert.equal(fold('Concor'), fold('konkor'), 'c и k');
  assert.equal(fold('Kalsiy'), fold('kaltsiy'), 'ts и s');
  assert.equal(fold('allopurinol'), fold('alopurinol'), 'удвоение согласных');
  assert.equal(fold("sunʼiy koʻz"), fold('suniy koz'), 'апострофы');
});

test('fold сохраняет ch как отдельный звук', () => {
  // Иначе «ch» превратилось бы в «kh» и слова со звуком «ч» перестали бы совпадать.
  assert.equal(fold('Чойхона'), fold('choyhona'));
  assert.notEqual(fold('chek'), fold('kek'));
});

test('ответ о самочувствии распознаётся в живой фразе', () => {
  const cases: [string, string][] = [
    ['yaxshiman, rahmat', 'good'],
    ['Яхшиман', 'good'],
    ['хорошо, спасибо', 'good'],
    ['нормально', 'good'],
    ['oʻrtacha', 'ok'],
    ['так себе сегодня', 'ok'],
    ['yomon, holim yoʻq', 'bad'],
    ['плохо себя чувствую', 'bad'],
  ];
  for (const [heard, expected] of cases) {
    assert.equal(matchSpoken(heard, FEELING_PHRASES), expected, `«${heard}»`);
  }
});

test('симптом распознаётся в разговорной фразе', () => {
  const cases: [string, string][] = [
    ['boshim ogʻriyapti', 'headache'],
    ['у меня болит голова', 'headache'],
    ['нафасим қисяпти', 'breathless'],
    ['задыхаюсь немного', 'breathless'],
    ['кўкрагим оғрияпти', 'chest-pain'],
    ['живот болит со вчера', 'stomach'],
    ['давление поднялось', 'pressure'],
  ];
  for (const [heard, expected] of cases) {
    assert.equal(matchSpoken(heard, SYMPTOM_PHRASES), expected, `«${heard}»`);
  }
});

test('«да» и «нет» различаются', () => {
  const yesNo = [
    { value: true, phrases: YES_PHRASES },
    { value: false, phrases: NO_PHRASES },
  ];
  assert.equal(matchSpoken('ha, bor', yesNo), true);
  assert.equal(matchSpoken('да', yesNo), true);
  assert.equal(matchSpoken('yoʻq', yesNo), false);
  assert.equal(matchSpoken('нет, ничего', yesNo), false);
});

test('непонятная фраза не выбирает случайный вариант', () => {
  assert.equal(matchSpoken('', FEELING_PHRASES), null);
  assert.equal(matchSpoken('бла бла бла', FEELING_PHRASES), null);
  assert.equal(matchSpoken('qwerty', SYMPTOM_PHRASES), null);
});

test('побеждает самое длинное совпадение', () => {
  // «болит» есть и в «bad», и внутри фраз симптомов — выигрывает точная фраза.
  const options = [
    { value: 'short', phrases: ['голова'] },
    { value: 'long', phrases: ['болит голова'] },
  ];
  assert.equal(matchSpoken('у меня болит голова', options), 'long');
});
