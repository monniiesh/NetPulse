import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    console.log('Running Drizzle migrations...');
    await migrate(db, { migrationsFolder: join(__dirname, 'migrations') });
    console.log('Drizzle migrations complete');

    console.log('Running TimescaleDB setup...');
    const timescaleSQL = readFileSync(
      join(__dirname, 'migrations', '0001_timescaledb_setup.sql'),
      'utf-8'
    );
    await pool.query(timescaleSQL);
    console.log('TimescaleDB setup complete');

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
