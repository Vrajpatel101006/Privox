const { Client } = require('pg');

// Test 1: with URL-encoded password via direct host
async function tryConnect(label, config) {
  const c = new Client({ ...config, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    await c.connect();
    const res = await c.query('SELECT current_user');
    console.log(`✅ ${label}: ${res.rows[0].current_user}`);
    await c.end();
    return true;
  } catch (e) {
    console.error(`❌ ${label}: ${e.message}`);
    return false;
  }
}

(async () => {
  const pass = '[Vraj@10Patel]';
  const proj = 'owrrkhjefkczayiwprhz';

  // Direct host, plain user "postgres"
  await tryConnect('Direct (postgres)', {
    host: `db.${proj}.supabase.co`, port: 5432,
    database: 'postgres', user: 'postgres', password: pass,
  });

  // Pooler port 6543, compound user
  await tryConnect('Pooler 6543 (postgres.ref)', {
    host: `aws-0-ap-south-1.pooler.supabase.com`, port: 6543,
    database: 'postgres', user: `postgres.${proj}`, password: pass,
  });

  // Pooler port 5432, compound user
  await tryConnect('Pooler 5432 (postgres.ref)', {
    host: `aws-0-ap-south-1.pooler.supabase.com`, port: 5432,
    database: 'postgres', user: `postgres.${proj}`, password: pass,
  });
})();
