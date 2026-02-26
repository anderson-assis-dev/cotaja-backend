// Check Order 1 attachments format (old format)
const mysql = require('mysql2/promise');

async function checkOrder1() {
    const connection = await mysql.createConnection({
        host: '159.195.32.169',
        port: 3306,
        user: 'andrepiropo',
        password: 'piropo1603a*#',
        database: 'cotaja'
    });

    try {
        const [orders] = await connection.execute(
            'SELECT id, attachments FROM orders WHERE id = 1'
        );

        if (orders.length > 0) {
            const parsed = JSON.parse(orders[0].attachments);
            console.log('Order 1 attachments:');
            console.log(JSON.stringify(parsed, null, 2));
        }
    } finally {
        await connection.end();
    }
}

checkOrder1().catch(console.error);
