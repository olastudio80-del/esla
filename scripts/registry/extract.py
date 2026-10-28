"""Извлекает из реестра то, что нужно приложению: название, МНН, форму и дозировки.

Цены, производителя и номера регистрации не берём: приложение подсказывает
название при вводе рецепта, а не торгует лекарствами.

Форму ищем по ключевым словам в описании упаковки, а не по позиции первой
цифры: у многих марок цифра в самом названии («ОМЕГАСТ® 20», «Нексогет IV»),
и позиционный разбор на них рассыпается, утаскивая текст формы в дозировку.
"""
import sys, re, json, collections
import openpyxl

# Порядок важен: длинные и уточняющие формулировки проверяются первыми.
FORM_PATTERNS = [
    (r'табл\w*',                        'tablet'),
    (r'капсул\w*',                      'capsule'),
    (r'сироп\w*',                       'syrup'),
    (r'капл\w+\s+глазн\w+|глазн\w+\s+капл\w+|капл\w+', 'drops'),
    (r'мазь|крем|гель|линимент',        'ointment'),
    (r'спрей|аэрозол\w*',               'spray'),
    (r'\w*ингал\w*',                    'inhaler'),
    (r'пластыр\w*',                     'patch'),
    (r'суппозитори\w*|свеч\w+',         'suppository'),
    (r'(порошок|лиофилизат|концентрат)[^.]{0,60}?(инъекц|инфуз|внутривен|внутримыш)', 'injection'),
    (r'(раствор|суспензи\w+|эмульси\w+)[^.]{0,60}?(инъекц|инфуз|внутривен|внутримыш|подкож)', 'injection'),
    (r'порошок|гранул\w*',              'powder'),
    (r'(раствор|суспензи\w+)[^.]{0,40}?(внутрь|приема|приёма|оральн)', 'suspension'),
    (r'раствор\w*',                     'solution'),
    (r'суспензи\w*',                    'suspension'),
]
COMPILED = [(re.compile(p, re.IGNORECASE), name) for p, name in FORM_PATTERNS]

PACKAGING = re.compile(
    r'\s*(блистер|флакон|ампул|упаковк|туб|банк|пакет|контурн|шприц|саше|стрип|'
    r'коробк|пачк|пенал|№|комплект|картон|полимерн|стеклянн|бутыл|канистр|'
    r'небул|капельниц|дозатор|предварительно|контейнер|в\s+комплекте)', re.IGNORECASE)

UNITS = [
    (r'миллилитр\w*', 'мл'), (r'миллиграмм\w*', 'мг'), (r'микрограмм\w*', 'мкг'),
    (r'\bграмм\w*', 'г'),    (r'литр\w*', 'л'),        (r'\bЕД\b', 'ЕД'),
]

def normalize_strength(value: str) -> str:
    s = value.strip(' ,;.-')
    for pattern, unit in UNITS:
        s = re.sub(pattern, unit, s, flags=re.IGNORECASE)
    s = re.sub(r'\s+', ' ', s).strip(' ,;.-')
    # Дозировка не бывает длиннее сорока знаков; длиннее — значит разбор не удался.
    return s if 2 <= len(s) <= 40 and re.search(r'\d', s) else ''

def parse(pack: str):
    text = re.sub(r'\s+', ' ', pack.strip())
    best = None
    for regex, name in COMPILED:
        m = regex.search(text)
        if m and (best is None or m.start() < best[0].start()):
            best = (m, name)
    if best is None:
        return 'other', ''

    match, form = best
    rest = text[match.end():]
    # Дозировка всегда начинается с цифры. Отсчёт от неё, а не от конца
    # совпадения: образец формы может оборваться на середине слова
    # («...для инъекц|ий»), и остаток слова попал бы в дозировку.
    digit = re.search(r'\d', rest)
    if not digit:
        return form, ''
    tail = rest[digit.start():]
    cut = PACKAGING.search(tail)
    return form, normalize_strength(tail[:cut.start()] if cut else tail)

ws = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)['Referent narxlar']
grouped = collections.OrderedDict()

for row in ws.iter_rows(min_row=2, values_only=True):
    brand, inn, pack = row[1], row[2], row[4]
    if not brand or not pack:
        continue
    brand = re.sub(r'\s+', ' ', str(brand).strip())
    inn = re.sub(r'\s+', ' ', str(inn).strip().lower()) if inn else ''
    form, strength = parse(str(pack))

    entry = grouped.setdefault((brand.lower(), inn, form),
                               {'name': brand, 'inn': inn, 'form': form, 'strengths': []})
    if strength and strength not in entry['strengths']:
        entry['strengths'].append(strength)

items = [i for i in grouped.values()]
for it in items:
    it['strengths'] = it['strengths'][:6]

json.dump(items, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print('позиций:', len(items))
print('по формам:', dict(collections.Counter(i['form'] for i in items).most_common()))
print('без дозировки:', sum(1 for i in items if not i['strengths']))
print('различных дозировок:', len({s for i in items for s in i['strengths']}))
print('\nпроверка на проблемных марках:')
for it in items:
    if it['name'].lower().startswith(('омегаст', 'нексогет', 'пантап')):
        print('  ', it['name'][:24], '|', it['form'], '|', it['strengths'][:3])
