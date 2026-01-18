const mysql = require('mysql2/promise');

async function runMigration() {
    const connection = await mysql.createConnection({
        host: '164.152.40.94',
        user: 'cotaja',
        password: 'cota*#ja',
        database: 'cotaja'
    });

    try {
        console.log('🔄 Executando migration: add_attachments_to_orders');

        await connection.execute(`
            ALTER TABLE orders
            ADD COLUMN attachments JSON NULL COMMENT 'Array of attachment files (photos, videos, documents)'
        `);

        console.log('✅ Migration executada com sucesso!');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  Campo attachments já existe na tabela orders');
        } else {
            console.error('❌ Erro ao executar migration:', error.message);
            throw error;
        }
    } finally {
        await connection.end();
    }
}

runMigration().catch(console.error);
