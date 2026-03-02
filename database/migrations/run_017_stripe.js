const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await conn.execute('ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER birth_date');
    console.log('✅ Coluna stripe_customer_id adicionada com sucesso');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('⚠️  Coluna já existe, nada a fazer');
    else { console.error('❌ Erro:', e.message); process.exit(1); }
  } finally {
    await conn.end();
  }
}

run();
