// Check total response size when fetching all orders with base64 images
const mysql = require('mysql2/promise');

async function checkResponseSize() {
    const connection = await mysql.createConnection({
        host: '159.195.32.169',
        port: 3306,
        user: 'andrepiropo',
        password: 'piropo1603a*#',
        database: 'cotaja'
    });

    try {
        // Get all orders with attachments
        const [orders] = await connection.execute(
            'SELECT id, title, LENGTH(attachments) as att_length, attachments FROM orders WHERE attachments IS NOT NULL AND attachments != "[]"'
        );

        let totalSize = 0;
        for (const order of orders) {
            const len = order.att_length || 0;
            totalSize += len;

            // Parse and check structure
            let parsed = [];
            try {
                parsed = JSON.parse(order.attachments);
            } catch(e) {}

            const imageAtts = parsed.filter(a => a.type === 'image' || (a.mime_type && a.mime_type.startsWith('image/')));
            const hasData = imageAtts.filter(a => a.data);
            const hasPath = imageAtts.filter(a => a.path);

            console.log(`Order ${order.id} (${order.title}):`);
            console.log(`  Total attachments JSON size: ${(len / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Total attachments: ${parsed.length}`);
            console.log(`  Images: ${imageAtts.length} (with data: ${hasData.length}, with path: ${hasPath.length})`);

            // Check first image's data field (just first 100 chars)
            if (hasData.length > 0) {
                const firstData = hasData[0].data;
                console.log(`  First image data starts with: ${firstData ? firstData.substring(0, 80) : 'NULL'}`);
                console.log(`  First image data length: ${firstData ? firstData.length : 0} chars`);
                console.log(`  Has mime_type: ${hasData[0].mime_type}`);
                console.log(`  Has type: ${hasData[0].type}`);
            }

            // Check non-image attachments
            const nonImage = parsed.filter(a => a.type !== 'image');
            if (nonImage.length > 0) {
                console.log(`  Non-image attachments: ${nonImage.length}`);
                nonImage.forEach(a => {
                    console.log(`    - ${a.original_name}: type=${a.type}, mime_type=${a.mime_type}, path=${a.path || 'N/A'}`);
                });
            }
            console.log('');
        }

        console.log(`\n📊 TOTAL size of all attachments data: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   If ALL orders returned at once, the JSON response would be ~${(totalSize / 1024 / 1024).toFixed(2)} MB+`);

    } finally {
        await connection.end();
    }
}

checkResponseSize().catch(console.error);
