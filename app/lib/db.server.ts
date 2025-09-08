export function getDB(env: any): D1Database {
  return (env as any).DB as unknown as D1Database;
}

export async function ensureUsersTable(db: D1Database) {
  await db
    .exec(
      `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      liveness_completed INTEGER NOT NULL DEFAULT 0
    );`
    )
    .catch(() => {});
}
