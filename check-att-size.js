const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '159.195.32.169',
    port: 3306,
    user: 'andrepiropo',
    password: 'piropo1603a*#',
    database: 'cotaja'
  });

  const [rows] = await conn.execute(
    'SELECT id, LENGTH(attachments) as att_size FROM orders WHERE attachments IS NOT NULL ORDER BY id DESC LIMIT 10'
  );

  rows.forEach(r => {
    const sizeMB = (r.att_size / (1024 * 1024)).toFixed(2);
    console.log('Order', r.id, '=> attachments size:', r.att_size, 'bytes (', sizeMB, 'MB)');
  });

  // Also check max_allowed_packet
  const [vars] = await conn.execute("SHOW VARIABLES LIKE 'max_allowed_packet'");
  console.log('\nMySQL max_allowed_packet:', vars[0].Value, 'bytes (', (vars[0].Value / (1024 * 1024)).toFixed(0), 'MB)');

  await conn.end();
})();
