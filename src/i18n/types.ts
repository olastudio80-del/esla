import type { uz } from './uz';

/** Узбекский задаёт набор ключей; остальные языки обязаны его повторить. */
export type Dict = { [K in keyof typeof uz]: string };
export type TKey = keyof Dict;
