import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './schema';

const DB_NAME = 'esla.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Открывает базу и догоняет миграции. Повторные вызовы получают то же
 * соединение — открывать базу дважды нельзя, иначе ловим «database is locked».
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    // Каскадные удаления и WAL: при живом интерфейсе чтения не блокируют запись.
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await migrate(db);
    return db;
  })();
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
    });
    // PRAGMA не принимает параметры, поэтому номер версии подставляем в текст.
    // Значение — индекс массива миграций, не пользовательский ввод.
    await db.execAsync(`PRAGMA user_version = ${version + 1}`);
  }
}

/** Только для тестов и отладки: сбрасывает кэш соединения. */
export function resetDbHandle() {
  dbPromise = null;
}
