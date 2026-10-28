import { getDb } from './index';
import type { ConditionKind, ConditionRow, DocKind, DocumentRow } from './types';

import { dateKey, localISO } from '@/lib/date';

export async function listDocuments(): Promise<DocumentRow[]> {
  const db = await getDb();
  return db.getAllAsync<DocumentRow>(
    'SELECT * FROM documents ORDER BY COALESCE(taken_on, created_at) DESC',
  );
}

export async function addDocument(input: {
  title: string;
  kind: DocKind;
  uri: string;
  mime?: string | null;
  takenOn?: string | null;
}): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO documents (title, kind, uri, mime, taken_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.title.trim(),
      input.kind,
      input.uri,
      input.mime ?? null,
      input.takenOn ?? dateKey(),
      localISO(),
    ],
  );
  return res.lastInsertRowId;
}

export async function deleteDocument(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM documents WHERE id = ?', [id]);
}

export async function listConditions(kind?: ConditionKind): Promise<ConditionRow[]> {
  const db = await getDb();
  if (kind) {
    return db.getAllAsync<ConditionRow>(
      'SELECT * FROM conditions WHERE kind = ? ORDER BY created_at',
      [kind],
    );
  }
  return db.getAllAsync<ConditionRow>('SELECT * FROM conditions ORDER BY kind, created_at');
}

export async function addCondition(kind: ConditionKind, label: string): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO conditions (kind, label, created_at) VALUES (?, ?, ?)',
    [kind, label.trim(), localISO()],
  );
  return res.lastInsertRowId;
}

export async function deleteCondition(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM conditions WHERE id = ?', [id]);
}
