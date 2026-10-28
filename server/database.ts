import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Client, InValue } from '@libsql/client';

type Row = Record<string, unknown>;

/** One async SQL interface for local SQLite and durable libSQL over HTTPS. */
export class Database {
  readonly remote: boolean;
  private local?: DatabaseSync;
  private client?: Promise<Client>;

  constructor(path: string, connection?: { url: string; authToken: string }) {
    this.remote = !!connection;
    if (connection) {
      const url = new URL(connection.url);
      if (!['libsql:', 'https:'].includes(url.protocol))
        throw new Error('Remote database requires a libsql:// or https:// URL.');
      this.client = import('@libsql/client/web').then(({ createClient }) =>
        createClient({ url: connection.url, authToken: connection.authToken }),
      );
    } else this.local = new DatabaseSync(path);
  }

  prepare(sql: string) {
    const execute = async (args: SQLInputValue[]) => {
      const client = await this.client!;
      return client.execute({ sql, args: args as InValue[] });
    };
    return {
      get: async (...args: SQLInputValue[]): Promise<Row | undefined> =>
        this.local ? this.local.prepare(sql).get(...args) : (await execute(args)).rows[0],
      all: async (...args: SQLInputValue[]): Promise<Row[]> =>
        this.local ? this.local.prepare(sql).all(...args) : (await execute(args)).rows,
      run: async (...args: SQLInputValue[]) => ({
        changes: this.local
          ? Number(this.local.prepare(sql).run(...args).changes)
          : (await execute(args)).rowsAffected,
      }),
    };
  }

  async exec(sql: string) {
    if (this.local) this.local.exec(sql);
    else await (await this.client!).executeMultiple(sql);
  }

  close() {
    this.local?.close();
    void this.client?.then((client) => client.close());
  }
}
