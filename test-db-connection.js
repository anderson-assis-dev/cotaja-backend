const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
    console.log('🔍 Testing database connection...');
    console.log('Configuration:');
    console.log('  Host:', process.env.DB_HOST);
    console.log('  Port:', process.env.DB_PORT);
    console.log('  Database:', process.env.DB_DATABASE);
    console.log('  Username:', process.env.DB_USERNAME);
    console.log('  Password:', process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-3) : 'empty');

    const configs = [
        {
            name: 'Current config (user: cotaja)',
            config: {
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE
            }
        },
        {
            name: 'Try with root user',
            config: {
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: 'root',
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE
            }
        },
        {
            name: 'Without database selection (user: cotaja)',
            config: {
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD
            }
        }
    ];

    for (const test of configs) {
        try {
            console.log(`\n📌 Testing: ${test.name}`);
            const connection = await mysql.createConnection(test.config);
            console.log(`✅ SUCCESS with ${test.name}`);

            // Try to query databases
            const [databases] = await connection.query('SHOW DATABASES');
            console.log('   Available databases:', databases.map(d => d.Database).join(', '));

            await connection.end();
        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
        }
    }
}

testConnection();
