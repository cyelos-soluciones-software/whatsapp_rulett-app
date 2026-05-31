import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL no está definida');
  }
  return url;
}

function resolveSsl(databaseUrl: string): boolean {
  const explicit = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return !/localhost|127\.0\.0\.1/.test(databaseUrl);
}

async function main(): Promise<void> {
  const schemaPath = join(__dirname, '..', 'sql', 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolveSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await pool.query(sql);
    console.log('Schema aplicado correctamente desde sql/schema.sql');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error al aplicar schema: ${message}`);
  process.exit(1);
});
