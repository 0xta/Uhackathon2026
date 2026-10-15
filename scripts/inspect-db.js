const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tastechain'
});

async function run() {
  const constraints = await pool.query(`
    SELECT c.conname, c.contype, r.relname 
    FROM pg_constraint c 
    JOIN pg_class r ON c.conrelid = r.oid 
    WHERE r.relname IN ('daily_token_epochs', 'user_epoch_shares', 'shop_voices', 'in_store_qr_checkins', 'verified_reviews', 'pioneer_claims')
  `);
  console.log("Constraints:", constraints.rows);
  await pool.end();
}

run().catch(console.error);
