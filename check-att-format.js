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
    'SELECT id, attachments FROM orders WHERE attachments IS NOT NULL ORDER BY id DESC LIMIT 5'
  );

  rows.forEach(r => {
    console.log('=== Order', r.id, '===');
    const atts = JSON.parse(r.attachments);
    atts.forEach((a, i) => {
      console.log('  Att', i, '=> keys:', Object.keys(a).join(', '));
      console.log('    type:', a.type, '| mime_type:', a.mime_type);
      console.log('    has data field:', !!a.data);
      console.log('    has path field:', !!a.path, '| path:', a.path || 'N/A');
      if (a.data) console.log('    data starts with:', a.data.substring(0, 40));
    });
    console.log();
  });

  await conn.end();
})();
