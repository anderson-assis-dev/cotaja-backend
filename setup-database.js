const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '12345678'
};

async function setupDatabase() {
    let connection;

    try {
        console.log('🔗 Connecting to MySQL server...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL server');

        // Create database
        console.log('📋 Creating database cotaja...');
        await connection.execute('CREATE DATABASE IF NOT EXISTS cotaja CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        console.log('✅ Database cotaja created');

        // Use the database
        await connection.execute('USE cotaja');
        console.log('📋 Using database cotaja');

        // Read and execute migration files
        const migrationsDir = path.join(__dirname, 'database', 'migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        console.log(`📋 Found ${migrationFiles.length} migration files`);

        for (const file of migrationFiles) {
            console.log(`⚡ Executing migration: ${file}`);
            const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

            // Split SQL content by semicolon and execute each statement
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

            for (const statement of statements) {
                if (statement.trim()) {
                    await connection.execute(statement);
                }
            }
            console.log(`✅ Migration ${file} executed successfully`);
        }

        console.log('🎉 Database setup completed successfully!');

        // Test the connection with the new database
        console.log('🔍 Testing database connection...');
        const [rows] = await connection.execute('SHOW TABLES');
        console.log(`✅ Database has ${rows.length} tables:`, rows.map(row => Object.values(row)[0]));

    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔗 Database connection closed');
        }
    }
}

// Run setup
setupDatabase();