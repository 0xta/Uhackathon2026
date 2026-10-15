import { Pool, QueryResult, QueryResultRow } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/tastechain";

// Global pool instance to prevent connection leaks across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

const pool: Pool =
  global.__dbPool ||
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  global.__dbPool = pool;
}

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL) {
      console.log("Executed query", { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error("Database query error:", { text, error });
    throw error;
  }
}

export async function getClient() {
  return await pool.connect();
}

export default pool;
