import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface Migration {
  name: string;
  sql: string;
}

export async function loadMigrations(directory = join(process.cwd(), "migrations")): Promise<Migration[]> {
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    files.map(async (file) => ({
      name: file,
      sql: await readFile(join(directory, file), "utf8")
    }))
  );
}

export async function applyMigrations(
  execute: (sql: string) => Promise<unknown>,
  migrations?: Migration[]
): Promise<void> {
  const migrationsToApply = migrations ?? (await loadMigrations());

  for (const migration of migrationsToApply) {
    await execute(migration.sql);
  }
}
