import { sql } from 'drizzle-orm';

/** Array Postgres bertipe, mis. pgArray([1,2], 'int') -> array[$1,$2]::int[] (kosong -> '{}'::int[]). */
export function pgArray(values: (string | number)[], type: string) {
  const t = sql.raw(`${type}[]`);
  if (!values.length) return sql`'{}'::${t}`;
  return sql`array[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `
  )}]::${t}`;
}
