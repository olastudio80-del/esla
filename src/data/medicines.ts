/**
 * Справочник препаратов для подсказок при вводе рецепта.
 *
 * ЧЕСТНО О ПРОИСХОЖДЕНИИ: это НЕ выгрузка Государственного реестра
 * лекарственных средств Узбекистана. Это составленный вручную список часто
 * назначаемых препаратов — чтобы пожилой человек не набирал длинное название
 * по буквам и не ошибался в нём. В интерфейсе он подписан как «справочник
 * препаратов», а не «госреестр».
 *
 * Когда появится официальная выгрузка (CSV/Excel от агентства), её нужно
 * положить рядом как registry.generated.ts с той же формой CatalogEntry и
 * подключить в CATALOG — остальной код менять не придётся.
 *
 * Здесь только названия, формы и зарегистрированные дозировки. Показаний и
 * схем приёма тут намеренно нет: что и как принимать, решает врач, а
 * объясняет назначенное — помощник, на основе конкретного рецепта.
 */

export type MedForm =
  | 'tablet'
  | 'capsule'
  | 'syrup'
  | 'injection'
  | 'drops'
  | 'ointment'
  | 'powder'
  | 'spray'
  | 'inhaler'
  | 'patch';

export type GroupKey =
  | 'heart'
  | 'pressure'
  | 'lipids'
  | 'blood'
  | 'diabetes'
  | 'thyroid'
  | 'stomach'
  | 'lungs'
  | 'pain'
  | 'nerves'
  | 'urology'
  | 'bones'
  | 'vitamins'
  | 'allergy'
  | 'infection'
  | 'eyes';

export type CatalogEntry = {
  id: string;
  /** Название латиницей — как пишут в узбекских рецептах. */
  uz: string;
  /** Название по-русски — как пишут в русскоязычных рецептах. */
  ru: string;
  /** Торговые названия: нужны для поиска, человек часто помнит именно их. */
  brands?: string[];
  form: MedForm;
  /** Зарегистрированные дозировки для быстрого выбора. */
  strengths: string[];
  group: GroupKey;
};

const E = (
  id: string,
  uz: string,
  ru: string,
  form: MedForm,
  strengths: string[],
  group: GroupKey,
  brands?: string[],
): CatalogEntry => ({ id, uz, ru, form, strengths, group, brands });

export const CATALOG: CatalogEntry[] = [
  // ——— Давление: ингибиторы АПФ и сартаны ———
  E('lisinopril', 'Lizinopril', 'Лизиноприл', 'tablet', ['5 mg', '10 mg', '20 mg'], 'pressure', ['Diroton', 'Диротон']),
  E('enalapril', 'Enalapril', 'Эналаприл', 'tablet', ['5 mg', '10 mg', '20 mg'], 'pressure', ['Enap', 'Энап', 'Renitek']),
  E('captopril', 'Kaptopril', 'Каптоприл', 'tablet', ['25 mg', '50 mg'], 'pressure', ['Kapoten', 'Капотен']),
  E('ramipril', 'Ramipril', 'Рамиприл', 'tablet', ['2,5 mg', '5 mg', '10 mg'], 'pressure', ['Tritace', 'Хартил']),
  E('perindopril', 'Perindopril', 'Периндоприл', 'tablet', ['4 mg', '5 mg', '8 mg', '10 mg'], 'pressure', ['Prestarium', 'Престариум']),
  E('losartan', 'Lozartan', 'Лозартан', 'tablet', ['25 mg', '50 mg', '100 mg'], 'pressure', ['Lorista', 'Лориста', 'Cozaar']),
  E('valsartan', 'Valsartan', 'Валсартан', 'tablet', ['40 mg', '80 mg', '160 mg'], 'pressure', ['Diovan', 'Валз']),
  E('telmisartan', 'Telmisartan', 'Телмисартан', 'tablet', ['40 mg', '80 mg'], 'pressure', ['Micardis', 'Микардис']),
  E('candesartan', 'Kandesartan', 'Кандесартан', 'tablet', ['8 mg', '16 mg', '32 mg'], 'pressure', ['Atacand']),

  // ——— Давление: кальциевые блокаторы и центральные ———
  E('amlodipine', 'Amlodipin', 'Амлодипин', 'tablet', ['5 mg', '10 mg'], 'pressure', ['Norvasc', 'Норваск', 'Tenox']),
  E('nifedipine', 'Nifedipin', 'Нифедипин', 'tablet', ['10 mg', '20 mg', '40 mg'], 'pressure', ['Corinfar', 'Коринфар']),
  E('verapamil', 'Verapamil', 'Верапамил', 'tablet', ['40 mg', '80 mg'], 'heart', ['Isoptin', 'Изоптин']),
  E('diltiazem', 'Diltiazem', 'Дилтиазем', 'tablet', ['60 mg', '90 mg'], 'heart'),
  E('moxonidine', 'Moksonidin', 'Моксонидин', 'tablet', ['0,2 mg', '0,4 mg'], 'pressure', ['Physiotens', 'Физиотенз']),

  // ——— Сердце: бета-блокаторы ———
  E('bisoprolol', 'Bisoprolol', 'Бисопролол', 'tablet', ['2,5 mg', '5 mg', '10 mg'], 'heart', ['Concor', 'Конкор', 'Bidop']),
  E('metoprolol', 'Metoprolol', 'Метопролол', 'tablet', ['25 mg', '50 mg', '100 mg'], 'heart', ['Betaloc', 'Эгилок', 'Egilok']),
  E('atenolol', 'Atenolol', 'Атенолол', 'tablet', ['25 mg', '50 mg', '100 mg'], 'heart'),
  E('carvedilol', 'Karvedilol', 'Карведилол', 'tablet', ['6,25 mg', '12,5 mg', '25 mg'], 'heart', ['Dilatrend']),
  E('nebivolol', 'Nebivolol', 'Небиволол', 'tablet', ['5 mg'], 'heart', ['Nebilet', 'Небилет']),

  // ——— Сердце: мочегонные, нитраты, прочее ———
  E('hydrochlorothiazide', 'Gidroxlortiazid', 'Гидрохлортиазид', 'tablet', ['12,5 mg', '25 mg'], 'pressure', ['Hypothiazide', 'Гипотиазид']),
  E('indapamide', 'Indapamid', 'Индапамид', 'tablet', ['1,5 mg', '2,5 mg'], 'pressure', ['Arifon', 'Арифон', 'Indap']),
  E('furosemide', 'Furosemid', 'Фуросемид', 'tablet', ['40 mg'], 'heart', ['Lasix', 'Лазикс']),
  E('torasemide', 'Torasemid', 'Торасемид', 'tablet', ['5 mg', '10 mg'], 'heart', ['Diuver', 'Диувер']),
  E('spironolactone', 'Spironolakton', 'Спиронолактон', 'tablet', ['25 mg', '50 mg', '100 mg'], 'heart', ['Veroshpiron', 'Верошпирон']),
  E('digoxin', 'Digoksin', 'Дигоксин', 'tablet', ['0,25 mg'], 'heart'),
  E('isosorbide-mono', 'Izosorbid mononitrat', 'Изосорбида мононитрат', 'tablet', ['40 mg', '60 mg'], 'heart', ['Monocinque', 'Моночинкве']),
  E('nitroglycerin', 'Nitrogliserin', 'Нитроглицерин', 'tablet', ['0,5 mg'], 'heart', ['Nitromint']),
  E('ivabradine', 'Ivabradin', 'Ивабрадин', 'tablet', ['5 mg', '7,5 mg'], 'heart', ['Coraxan', 'Кораксан']),
  E('amiodarone', 'Amiodaron', 'Амиодарон', 'tablet', ['200 mg'], 'heart', ['Cordarone', 'Кордарон']),
  E('trimetazidine', 'Trimetazidin', 'Триметазидин', 'tablet', ['35 mg'], 'heart', ['Preductal', 'Предуктал']),

  // ——— Холестерин ———
  E('atorvastatin', 'Atorvastatin', 'Аторвастатин', 'tablet', ['10 mg', '20 mg', '40 mg', '80 mg'], 'lipids', ['Liprimar', 'Липримар', 'Atoris']),
  E('rosuvastatin', 'Rozuvastatin', 'Розувастатин', 'tablet', ['5 mg', '10 mg', '20 mg', '40 mg'], 'lipids', ['Crestor', 'Крестор', 'Mertenil']),
  E('simvastatin', 'Simvastatin', 'Симвастатин', 'tablet', ['10 mg', '20 mg', '40 mg'], 'lipids', ['Zocor']),
  E('fenofibrate', 'Fenofibrat', 'Фенофибрат', 'tablet', ['145 mg', '200 mg'], 'lipids', ['Tricor', 'Трайкор']),
  E('ezetimibe', 'Ezetimib', 'Эзетимиб', 'tablet', ['10 mg'], 'lipids', ['Ezetrol']),

  // ——— Кровь: антиагреганты и антикоагулянты ———
  E('aspirin-cardio', 'Asetilsalitsil kislota (kardio)', 'Ацетилсалициловая кислота (кардио)', 'tablet', ['75 mg', '100 mg'], 'blood', ['Aspirin Cardio', 'Кардиомагнил', 'Cardiomagnyl', 'ThromboASS']),
  E('clopidogrel', 'Klopidogrel', 'Клопидогрел', 'tablet', ['75 mg'], 'blood', ['Plavix', 'Плавикс']),
  E('warfarin', 'Varfarin', 'Варфарин', 'tablet', ['2,5 mg', '5 mg'], 'blood'),
  E('rivaroxaban', 'Rivaroksaban', 'Ривароксабан', 'tablet', ['2,5 mg', '10 mg', '15 mg', '20 mg'], 'blood', ['Xarelto', 'Ксарелто']),
  E('apixaban', 'Apiksaban', 'Апиксабан', 'tablet', ['2,5 mg', '5 mg'], 'blood', ['Eliquis', 'Эликвис']),
  E('dabigatran', 'Dabigatran', 'Дабигатран', 'capsule', ['75 mg', '110 mg', '150 mg'], 'blood', ['Pradaxa', 'Прадакса']),
  E('pentoxifylline', 'Pentoksifillin', 'Пентоксифиллин', 'tablet', ['100 mg', '400 mg'], 'blood', ['Trental', 'Трентал']),

  // ——— Диабет ———
  E('metformin', 'Metformin', 'Метформин', 'tablet', ['500 mg', '850 mg', '1000 mg'], 'diabetes', ['Glucophage', 'Глюкофаж', 'Siofor', 'Сиофор']),
  E('gliclazide', 'Gliklazid', 'Гликлазид', 'tablet', ['30 mg', '60 mg', '80 mg'], 'diabetes', ['Diabeton', 'Диабетон']),
  E('glimepiride', 'Glimepirid', 'Глимепирид', 'tablet', ['1 mg', '2 mg', '3 mg', '4 mg'], 'diabetes', ['Amaryl', 'Амарил']),
  E('glibenclamide', 'Glibenklamid', 'Глибенкламид', 'tablet', ['5 mg'], 'diabetes', ['Maninil', 'Манинил']),
  E('sitagliptin', 'Sitagliptin', 'Ситаглиптин', 'tablet', ['25 mg', '50 mg', '100 mg'], 'diabetes', ['Januvia', 'Янувия']),
  E('vildagliptin', 'Vildagliptin', 'Вилдаглиптин', 'tablet', ['50 mg'], 'diabetes', ['Galvus', 'Галвус']),
  E('empagliflozin', 'Empagliflozin', 'Эмпаглифлозин', 'tablet', ['10 mg', '25 mg'], 'diabetes', ['Jardiance', 'Джардинс']),
  E('dapagliflozin', 'Dapagliflozin', 'Дапаглифлозин', 'tablet', ['5 mg', '10 mg'], 'diabetes', ['Forxiga', 'Форсига']),
  E('insulin-glargine', 'Insulin glargin', 'Инсулин гларгин', 'injection', ['100 BH/ml'], 'diabetes', ['Lantus', 'Лантус', 'Toujeo']),
  E('insulin-aspart', 'Insulin aspart', 'Инсулин аспарт', 'injection', ['100 BH/ml'], 'diabetes', ['NovoRapid', 'НовоРапид']),
  E('insulin-nph', 'Insulin izofan (NPH)', 'Инсулин изофан (НПХ)', 'injection', ['100 BH/ml'], 'diabetes', ['Protaphane', 'Humulin N']),

  // ——— Щитовидная железа ———
  E('levothyroxine', 'Levotiroksin', 'Левотироксин', 'tablet', ['25 mkg', '50 mkg', '75 mkg', '100 mkg'], 'thyroid', ['L-Thyroxin', 'Эутирокс', 'Euthyrox']),
  E('thiamazole', 'Tiamazol', 'Тиамазол', 'tablet', ['5 mg', '10 mg'], 'thyroid', ['Mercazolil', 'Мерказолил', 'Tyrozol']),

  // ——— Желудок и кишечник ———
  E('omeprazole', 'Omeprazol', 'Омепразол', 'capsule', ['20 mg', '40 mg'], 'stomach', ['Omez', 'Омез', 'Losec']),
  E('pantoprazole', 'Pantoprazol', 'Пантопразол', 'tablet', ['20 mg', '40 mg'], 'stomach', ['Controloc', 'Нольпаза']),
  E('esomeprazole', 'Ezomeprazol', 'Эзомепразол', 'tablet', ['20 mg', '40 mg'], 'stomach', ['Nexium', 'Нексиум']),
  E('famotidine', 'Famotidin', 'Фамотидин', 'tablet', ['20 mg', '40 mg'], 'stomach'),
  E('domperidone', 'Domperidon', 'Домперидон', 'tablet', ['10 mg'], 'stomach', ['Motilium', 'Мотилиум']),
  E('drotaverine', 'Drotaverin', 'Дротаверин', 'tablet', ['40 mg', '80 mg'], 'stomach', ['No-shpa', 'Но-шпа']),
  E('mebeverine', 'Mebeverin', 'Мебеверин', 'capsule', ['200 mg'], 'stomach', ['Duspatalin', 'Дюспаталин']),
  E('ursodeoxycholic', 'Ursodeoksixol kislota', 'Урсодезоксихолевая кислота', 'capsule', ['250 mg', '500 mg'], 'stomach', ['Ursosan', 'Урсосан', 'Ursofalk']),
  E('lactulose', 'Laktuloza', 'Лактулоза', 'syrup', ['667 mg/ml'], 'stomach', ['Duphalac', 'Дюфалак']),
  E('bisacodyl', 'Bisakodil', 'Бисакодил', 'tablet', ['5 mg'], 'stomach'),
  E('loperamide', 'Loperamid', 'Лоперамид', 'capsule', ['2 mg'], 'stomach', ['Imodium', 'Имодиум']),
  E('pancreatin', 'Pankreatin', 'Панкреатин', 'capsule', ['10 000 BH', '25 000 BH'], 'stomach', ['Creon', 'Креон', 'Mezim']),

  // ——— Лёгкие ———
  E('salbutamol', 'Salbutamol', 'Сальбутамол', 'inhaler', ['100 mkg/doza'], 'lungs', ['Ventolin', 'Вентолин']),
  E('budesonide-formoterol', 'Budesonid + formoterol', 'Будесонид + формотерол', 'inhaler', ['160/4,5 mkg', '320/9 mkg'], 'lungs', ['Symbicort', 'Симбикорт']),
  E('beclometasone', 'Beklometazon', 'Беклометазон', 'inhaler', ['100 mkg/doza', '250 mkg/doza'], 'lungs', ['Beclazone']),
  E('tiotropium', 'Tiotropiy', 'Тиотропий', 'inhaler', ['18 mkg'], 'lungs', ['Spiriva', 'Спирива']),
  E('ipratropium-salbutamol', 'Ipratropiy + salbutamol', 'Ипратропий + сальбутамол', 'inhaler', ['20/100 mkg'], 'lungs', ['Berodual', 'Беродуал']),
  E('montelukast', 'Montelukast', 'Монтелукаст', 'tablet', ['4 mg', '5 mg', '10 mg'], 'lungs', ['Singulair', 'Сингуляр']),
  E('ambroxol', 'Ambroksol', 'Амброксол', 'tablet', ['30 mg'], 'lungs', ['Lazolvan', 'Лазолван']),
  E('acetylcysteine', 'Asetilsistein', 'Ацетилцистеин', 'powder', ['200 mg', '600 mg'], 'lungs', ['ACC', 'АЦЦ', 'Fluimucil']),

  // ——— Боль и воспаление ———
  E('paracetamol', 'Paratsetamol', 'Парацетамол', 'tablet', ['500 mg'], 'pain', ['Panadol', 'Панадол', 'Efferalgan']),
  E('ibuprofen', 'Ibuprofen', 'Ибупрофен', 'tablet', ['200 mg', '400 mg'], 'pain', ['Nurofen', 'Нурофен']),
  E('diclofenac', 'Diklofenak', 'Диклофенак', 'tablet', ['50 mg', '75 mg', '100 mg'], 'pain', ['Voltaren', 'Вольтарен']),
  E('meloxicam', 'Meloksikam', 'Мелоксикам', 'tablet', ['7,5 mg', '15 mg'], 'pain', ['Movalis', 'Мовалис']),
  E('nimesulide', 'Nimesulid', 'Нимесулид', 'powder', ['100 mg'], 'pain', ['Nise', 'Найз']),
  E('celecoxib', 'Selekoksib', 'Целекоксиб', 'capsule', ['100 mg', '200 mg'], 'pain', ['Celebrex']),
  E('ketoprofen', 'Ketoprofen', 'Кетопрофен', 'tablet', ['100 mg'], 'pain', ['Ketonal', 'Кетонал']),
  E('prednisolone', 'Prednizolon', 'Преднизолон', 'tablet', ['5 mg'], 'pain'),
  E('dexamethasone', 'Deksametazon', 'Дексаметазон', 'injection', ['4 mg/ml'], 'pain'),

  // ——— Нервная система ———
  E('levodopa-carbidopa', 'Levodopa + karbidopa', 'Леводопа + карбидопа', 'tablet', ['250/25 mg', '100/25 mg'], 'nerves', ['Madopar', 'Наком', 'Nakom']),
  E('donepezil', 'Donepezil', 'Донепезил', 'tablet', ['5 mg', '10 mg'], 'nerves', ['Aricept']),
  E('memantine', 'Memantin', 'Мемантин', 'tablet', ['10 mg'], 'nerves', ['Akatinol', 'Акатинол']),
  E('amitriptyline', 'Amitriptilin', 'Амитриптилин', 'tablet', ['25 mg'], 'nerves'),
  E('gabapentin', 'Gabapentin', 'Габапентин', 'capsule', ['300 mg'], 'nerves', ['Neurontin']),
  E('pregabalin', 'Pregabalin', 'Прегабалин', 'capsule', ['75 mg', '150 mg'], 'nerves', ['Lyrica', 'Лирика']),
  E('carbamazepine', 'Karbamazepin', 'Карбамазепин', 'tablet', ['200 mg'], 'nerves', ['Finlepsin', 'Финлепсин']),
  E('valproate', 'Valproy kislota', 'Вальпроевая кислота', 'tablet', ['300 mg', '500 mg'], 'nerves', ['Depakine', 'Депакин']),
  E('betahistine', 'Betagistin', 'Бетагистин', 'tablet', ['8 mg', '16 mg', '24 mg'], 'nerves', ['Betaserc', 'Бетасерк']),
  E('piracetam', 'Piratsetam', 'Пирацетам', 'tablet', ['400 mg', '800 mg'], 'nerves', ['Nootropil']),
  E('glycine', 'Glitsin', 'Глицин', 'tablet', ['100 mg'], 'nerves'),
  E('phenazepam', 'Fenazepam', 'Феназепам', 'tablet', ['0,5 mg', '1 mg'], 'nerves', ['Феназепам']),

  // ——— Урология ———
  E('tamsulosin', 'Tamsulozin', 'Тамсулозин', 'capsule', ['0,4 mg'], 'urology', ['Omnic', 'Омник']),
  E('finasteride', 'Finasterid', 'Финастерид', 'tablet', ['5 mg'], 'urology', ['Proscar']),
  E('doxazosin', 'Doksazozin', 'Доксазозин', 'tablet', ['2 mg', '4 mg'], 'urology', ['Kardura']),
  E('solifenacin', 'Solifenatsin', 'Солифенацин', 'tablet', ['5 mg', '10 mg'], 'urology', ['Vesicare']),
  E('canephron', 'Kanefron', 'Канефрон', 'tablet', ['1 tabletka'], 'urology'),

  // ——— Кости, суставы, обмен ———
  E('allopurinol', 'Allopurinol', 'Аллопуринол', 'tablet', ['100 mg', '300 mg'], 'bones'),
  E('colchicine', 'Kolxitsin', 'Колхицин', 'tablet', ['0,5 mg'], 'bones'),
  E('alendronate', 'Alendron kislota', 'Алендроновая кислота', 'tablet', ['70 mg'], 'bones', ['Fosamax']),
  E('calcium-d3', 'Kalsiy + D3 vitamini', 'Кальций + витамин D3', 'tablet', ['500 mg/200 BH'], 'bones', ['Calcium D3 Nycomed', 'Кальций Д3 Никомед']),
  E('chondroitin-glucosamine', 'Xondroitin + glyukozamin', 'Хондроитин + глюкозамин', 'tablet', ['500/500 mg'], 'bones', ['Teraflex', 'Терафлекс']),

  // ——— Витамины и дефициты ———
  E('vitamin-d3', 'D3 vitamini', 'Витамин D3', 'drops', ['500 BH/tomchi', '2000 BH'], 'vitamins', ['Aquadetrim', 'Аквадетрим']),
  E('ferrous-sulfate', 'Temir sulfat', 'Железа сульфат', 'tablet', ['325 mg'], 'vitamins', ['Sorbifer', 'Сорбифер']),
  E('folic-acid', 'Fol kislota', 'Фолиевая кислота', 'tablet', ['1 mg', '5 mg'], 'vitamins'),
  E('cyanocobalamin', 'Siankobalamin (B12)', 'Цианокобаламин (B12)', 'injection', ['500 mkg/ml'], 'vitamins'),
  E('magnesium-b6', 'Magniy + B6', 'Магний + B6', 'tablet', ['470/5 mg'], 'vitamins', ['Magne B6', 'Магне B6']),
  E('potassium-magnesium', 'Kaliy + magniy asparaginat', 'Калия и магния аспарагинат', 'tablet', ['175/175 mg'], 'vitamins', ['Asparkam', 'Аспаркам', 'Panangin']),

  // ——— Аллергия ———
  E('cetirizine', 'Setirizin', 'Цетиризин', 'tablet', ['10 mg'], 'allergy', ['Zyrtec', 'Зиртек']),
  E('loratadine', 'Loratadin', 'Лоратадин', 'tablet', ['10 mg'], 'allergy', ['Claritin', 'Кларитин']),
  E('chloropyramine', 'Xloropiramin', 'Хлоропирамин', 'tablet', ['25 mg'], 'allergy', ['Suprastin', 'Супрастин']),

  // ——— Инфекции (курсом, по назначению) ———
  E('amoxicillin-clav', 'Amoksitsillin + klavulanat', 'Амоксициллин + клавуланат', 'tablet', ['500/125 mg', '875/125 mg'], 'infection', ['Augmentin', 'Аугментин', 'Amoksiklav']),
  E('azithromycin', 'Azitromitsin', 'Азитромицин', 'tablet', ['250 mg', '500 mg'], 'infection', ['Sumamed', 'Сумамед']),
  E('ciprofloxacin', 'Siprofloksatsin', 'Ципрофлоксацин', 'tablet', ['250 mg', '500 mg'], 'infection', ['Cifran', 'Ципролет']),
  E('levofloxacin', 'Levofloksatsin', 'Левофлоксацин', 'tablet', ['250 mg', '500 mg'], 'infection', ['Tavanic']),
  E('ceftriaxone', 'Seftriakson', 'Цефтриаксон', 'injection', ['1 g', '500 mg'], 'infection'),
  E('nitrofurantoin', 'Nitrofurantoin', 'Нитрофурантоин', 'tablet', ['100 mg'], 'infection', ['Furadonin', 'Фурадонин']),

  // ——— Глаза ———
  E('timolol-eye', 'Timolol (koʻz tomchisi)', 'Тимолол (глазные капли)', 'drops', ['0,25%', '0,5%'], 'eyes'),
  E('latanoprost', 'Latanoprost', 'Латанопрост', 'drops', ['0,005%'], 'eyes', ['Xalatan']),
  E('artificial-tears', 'Sunʼiy koʻz yoshi', 'Искусственная слеза', 'drops', ['0,15%', '0,4%'], 'eyes', ['Systane', 'Hilo-Comod']),
];

/** Названия групп для подписи в подсказках. */
export const GROUP_LABELS: Record<GroupKey, { uz: string; ru: string }> = {
  heart: { uz: 'Yurak', ru: 'Сердце' },
  pressure: { uz: 'Qon bosimi', ru: 'Давление' },
  lipids: { uz: 'Xolesterin', ru: 'Холестерин' },
  blood: { uz: 'Qon suyultiruvchi', ru: 'Разжижение крови' },
  diabetes: { uz: 'Qandli diabet', ru: 'Диабет' },
  thyroid: { uz: 'Qalqonsimon bez', ru: 'Щитовидная железа' },
  stomach: { uz: 'Oshqozon-ichak', ru: 'Желудок и кишечник' },
  lungs: { uz: 'Nafas olish', ru: 'Дыхание' },
  pain: { uz: 'Ogʻriq va yalligʻlanish', ru: 'Боль и воспаление' },
  nerves: { uz: 'Nerv sistemasi', ru: 'Нервная система' },
  urology: { uz: 'Siydik yoʻllari', ru: 'Мочевые пути' },
  bones: { uz: 'Suyak va boʻgʻimlar', ru: 'Кости и суставы' },
  vitamins: { uz: 'Vitaminlar', ru: 'Витамины' },
  allergy: { uz: 'Allergiya', ru: 'Аллергия' },
  infection: { uz: 'Infeksiya', ru: 'Инфекция' },
  eyes: { uz: 'Koʻz', ru: 'Глаза' },
};

/**
 * Приводит написание к единому виду для сравнения.
 *
 * Зачем так сложно: одно и то же лекарство в Узбекистане пишут и латиницей,
 * и кириллицей, и торговым названием, причём на слух — «Konkor» вместо
 * «Concor», «kaltsiy» вместо «Kalsiy», «Xloropiramin» вместо «Хлоропирамин».
 * Пожилой человек не станет подбирать правильную букву: если поиск не нашёл,
 * он решит, что приложение не работает. Поэтому кириллица переводится в
 * латиницу, а неоднозначные сочетания сводятся к одной форме:
 * c/k/q → k, ts/c → s, x/kh → h, zh → j, двойные согласные → одна.
 *
 * Это сравнение, а не отображение: пользователю всегда показываем исходное
 * написание из справочника.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Узбекская кириллица
  ў: 'o', қ: 'k', ғ: 'g', ҳ: 'h',
};

function normalize(value: string): string {
  let s = value
    .toLowerCase()
    // Все виды апострофов: oʻ, o', o` — пишут как попало.
    .replace(/[\u02bb\u02bc\u2018\u2019'`\u00b4]/g, '');

  s = s.replace(/[\u0400-\u04ff]/g, (ch) => CYRILLIC[ch] ?? ch);

  // Порядок важен: сначала трёх- и двухбуквенные сочетания, потом одиночные.
  s = s
    .replace(/shch|sch/g, 'sh')
    .replace(/zh/g, 'j')
    .replace(/kh/g, 'h')
    .replace(/ph/g, 'f')
    // ch сохраняем: это отдельный звук. Прячем, чтобы c→k его не разрушил.
    .replace(/ch/g, '\u0001')
    .replace(/ts/g, 's')
    .replace(/[cq]/g, 'k')
    .replace(/x/g, 'h')
    .replace(/w/g, 'v')
    .replace(/\u0001/g, 'ch')
    // Удвоение согласных на слух не различается: allopurinol / alopurinol.
    .replace(/([bdfgjklmnprstvz])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return s;
}

/** Все написания одного препарата, по которым его можно найти. */
function aliases(entry: CatalogEntry): string[] {
  return [entry.uz, entry.ru, ...(entry.brands ?? [])];
}

export type CatalogHit = {
  entry: CatalogEntry;
  /** Какое именно написание совпало — его и показываем в подсказке. */
  matched: string;
};

/**
 * Поиск по справочнику. Совпадение с начала названия идёт выше совпадения
 * в середине: набрав «metfo», человек ждёт «Metformin» первым, а не препарат,
 * у которого это внутри слова.
 */
export function searchCatalog(query: string, limit = 6): CatalogHit[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  const prefix: CatalogHit[] = [];
  const inner: CatalogHit[] = [];

  for (const entry of CATALOG) {
    let best: { matched: string; at: number } | null = null;
    for (const alias of aliases(entry)) {
      const at = normalize(alias).indexOf(q);
      if (at < 0) continue;
      // Среди написаний одного препарата выбираем самое раннее совпадение.
      if (!best || at < best.at) best = { matched: alias, at };
      if (at === 0) break;
    }
    if (!best) continue;
    (best.at === 0 ? prefix : inner).push({ entry, matched: best.matched });
  }

  const byName = (a: CatalogHit, b: CatalogHit) => a.matched.localeCompare(b.matched);
  return [...prefix.sort(byName), ...inner.sort(byName)].slice(0, limit);
}

export function findCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.id === id);
}
