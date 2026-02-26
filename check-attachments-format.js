const mysql = require('mysql2/promise');

(async () => {
    const connection = await mysql.createConnection({
        host: '159.195.32.169', port: 3306,
        user: 'andrepiropo', password: 'piropo1603a*#',
        database: 'cotaja'
    });
    const [orders] = await connection.execute('SELECT id, attachments FROM orders WHERE attachments IS NOT NULL LIMIT 10');
    for (const o of orders) {
        let parsed;
        try { parsed = JSON.parse(o.attachments); } catch(e) { parsed = o.attachments; }
        console.log('--- Order', o.id, '---');
        if (Array.isArray(parsed)) {
            parsed.forEach((att, i) => {
                console.log('  att', i, ':', JSON.stringify({
                    mime_type: att.mime_type,
                    type: att.type,
                    path: att.path,
                    has_data: !!att.data,
                    data_prefix: att.data ? att.data.substring(0, 30) : undefined,
                    filename: att.filename
                }));
            });
        } else {
            console.log('  raw:', JSON.stringify(parsed).substring(0, 200));
        }
    }
    await connection.end();
})().catch(console.error);
