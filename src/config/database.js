const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '12345678',
    database: process.env.DB_DATABASE || 'cotaja',
    waitForConnections: true,
    connectionLimit: 30,
    queueLimit: 100,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
};

const pool = mysql.createPool(dbConfig);

const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
    } catch (error) {
        console.error('❌ Error connecting to database:', error.message);
        console.log('⚠️ Continuing without database connection for testing...');
    }
};

module.exports = {
    pool,
    testConnection
};