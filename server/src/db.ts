import pg from 'pg';

const { Pool } = pg;
export const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgres://heat:heat@localhost:5432/heat',
});

export async function transaction<T>(
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const value = await work(client);
    await client.query('commit');
    return value;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
