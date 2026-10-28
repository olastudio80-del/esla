/**
 * Схема локальной базы. Телефон — источник правды: приложение обязано
 * полностью работать без сети и без браслета, поэтому всё лежит в SQLite,
 * а синхронизация с облаком (раздел «родители») надстраивается сверху.
 *
 * Новая версия схемы = новый элемент в MIGRATIONS. Старые не трогаем:
 * у пользователя на телефоне уже есть данные.
 */

export const MIGRATIONS: string[] = [
  // v1 — лекарства, расписание, приёмы, документы, диагнозы, показатели, чат
  `
  CREATE TABLE medications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    dosage        TEXT,
    form          TEXT,
    meal          TEXT    NOT NULL DEFAULT 'any',  -- before | after | any
    course_days   INTEGER,                          -- NULL = принимать постоянно
    started_on    TEXT    NOT NULL,                 -- YYYY-MM-DD
    note          TEXT,
    catalog_id    TEXT,                             -- id из справочника препаратов
    archived      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL
  );

  CREATE TABLE schedule_times (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id   INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    hour            INTEGER NOT NULL,
    minute          INTEGER NOT NULL,
    notification_id TEXT                            -- чтобы отменить уведомление при правке
  );
  CREATE INDEX idx_schedule_med ON schedule_times(medication_id);

  CREATE TABLE doses (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id    INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    schedule_time_id INTEGER REFERENCES schedule_times(id) ON DELETE SET NULL,
    planned_at       TEXT    NOT NULL,              -- ISO 8601, местное время
    status           TEXT    NOT NULL DEFAULT 'planned', -- planned|taken|missed|skipped
    acted_at         TEXT,
    synced           INTEGER NOT NULL DEFAULT 0,    -- отправлено родственнику
    UNIQUE(medication_id, planned_at)
  );
  CREATE INDEX idx_doses_planned ON doses(planned_at);
  CREATE INDEX idx_doses_status  ON doses(status);

  CREATE TABLE documents (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    kind       TEXT NOT NULL,                       -- analysis | report | other
    uri        TEXT NOT NULL,
    mime       TEXT,
    taken_on   TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE conditions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL,                       -- diagnosis | allergy
    label      TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE vitals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL,                      -- heart_rate | steps | sleep_minutes
    value       REAL NOT NULL,
    measured_at TEXT NOT NULL,
    source      TEXT,                               -- имя приложения-источника
    UNIQUE(kind, measured_at)
  );
  CREATE INDEX idx_vitals_kind ON vitals(kind, measured_at DESC);

  CREATE TABLE messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    role       TEXT NOT NULL,                       -- user | assistant
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // v2 — записи самочувствия: их ведёт голосовой помощник и они попадают
  // в «Kasallik tarixi» рядом с анализами, а также в экстренную медкарту.
  `
  CREATE TABLE checkins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT    NOT NULL,
    feeling    TEXT    NOT NULL,              -- good | ok | bad
    symptoms   TEXT    NOT NULL DEFAULT '[]', -- JSON-массив строк
    severity   INTEGER,                        -- 1..5, если человек оценил
    note       TEXT,
    source     TEXT    NOT NULL,              -- assistant | manual
    alarm      INTEGER NOT NULL DEFAULT 0,    -- тревожный симптом: к врачу
    synced     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_checkins_created ON checkins(created_at DESC);
  CREATE INDEX idx_checkins_alarm   ON checkins(alarm);
  `,

];
