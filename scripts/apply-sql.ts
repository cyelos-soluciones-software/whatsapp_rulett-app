import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
  const relativePath = process.argv[2];
  if (!relativePath) {
    throw new Error('Uso: tsx scripts/apply-sql.ts <ruta-sql>');
  }

  const sqlPath = resolve(join(__dirname, '..', relativePath));
  const sql = readFileSync(sqlPath, 'utf8');
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolveSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await pool.query(sql);
    console.log(`SQL aplicado: ${relativePath}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error al aplicar SQL: ${message}`);
  process.exit(1);
});
