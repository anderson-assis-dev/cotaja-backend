const { pool } = require('./src/config/database');

(async () => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT id, title, attachments FROM orders WHERE status = "open" LIMIT 5');

    console.log('Total orders found:', rows.length);
    console.log('');

    rows.forEach(r => {
      console.log('Order #' + r.id + ' - ' + r.title);
      console.log('  attachments type:', typeof r.attachments);
      console.log('  attachments isNull:', r.attachments === null);
      console.log('  isArray:', Array.isArray(r.attachments));

      if (r.attachments !== null) {
        const str = JSON.stringify(r.attachments);
        console.log('  value (first 500 chars):', str.substring(0, 500));

        if (typeof r.attachments === 'string') {
          try {
            const parsed = JSON.parse(r.attachments);
            console.log('  PARSED - isArray:', Array.isArray(parsed), 'length:', parsed.length);
            if (parsed.length > 0) {
              console.log('  first item keys:', Object.keys(parsed[0]));
              console.log('  first item:', JSON.stringify(parsed[0]));
            }
          } catch(e) {
            console.log('  parse error:', e.message);
          }
        } else if (Array.isArray(r.attachments)) {
          console.log('  ALREADY ARRAY - length:', r.attachments.length);
          if (r.attachments.length > 0) {
            console.log('  first item keys:', Object.keys(r.attachments[0]));
            console.log('  first item:', JSON.stringify(r.attachments[0]));
          }
        }
      } else {
        console.log('  NO ATTACHMENTS (null)');
      }
      console.log('---');
    });

    conn.release();
    process.exit(0);
  } catch(e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
