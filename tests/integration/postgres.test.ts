import { it, expect } from 'vitest';
import pg from 'pg';
it.skipIf(process.env.GREIVA_TEST_POSTGRES !== '1')('STEP1-POSTGRES: connects to the real development PostgreSQL', async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgresql://greiva:greiva_dev_only@127.0.0.1:5432/greiva_poc', connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const result = await client.query('select current_database() as database, version() as version');
    expect(result.rows[0].database).toBe('greiva_poc');
    expect(result.rows[0].version).toContain('PostgreSQL 18.4');
  } finally { await client.end(); }
});
