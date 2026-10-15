import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import { database } from '../../db/index.js';

const transactions = new AsyncLocalStorage<ReturnType<typeof database>>();
function query(statement: string, params: unknown[]) {
  const pieces = statement.split('?');
  if (pieces.length !== params.length + 1) throw new Error('Incorrect SQL parameter count');
  return sql.join(pieces.flatMap((piece, i) => i === params.length
    ? [sql.raw(piece)] : [sql.raw(piece), sql`${params[i]}`]), sql.raw(''));
}
export function getDatabase() {
  const execute = async (statement: string, params: unknown[]) => {
    const db = transactions.getStore() || database();
    const result = await db.execute(query(statement, params));
    // Postgres returns COUNT as bigint strings; the existing API expects numbers.
    const rows = result.rows.map((row: any) => Object.fromEntries(Object.entries(row).map(([key, value]) =>
      [key, ['count', 'icon_count', 'project_count'].includes(key) && value !== null ? Number(value) : value])));
    return { rows, changes: result.rowCount || 0 };
  };
  return {
    prepare(statement: string) {
      return {
        async all(...params: unknown[]): Promise<any[]> { return (await execute(statement, params)).rows; },
        async get(...params: unknown[]): Promise<any> { return (await execute(statement, params)).rows[0]; },
        async run(...params: unknown[]) { return { changes: (await execute(statement, params)).changes }; },
      };
    },
    transaction<T>(fn: () => Promise<T>) {
      return () => database().transaction(tx => transactions.run(tx as unknown as ReturnType<typeof database>, fn));
    },
  };
}
