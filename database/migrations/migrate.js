#!/usr/bin/env node
/**
 * Aplica um arquivo .sql de migration usando as credenciais do ambiente.
 *
 * Substitui o run_migration.js, que trazia host, usuario e senha de producao
 * escritos no proprio arquivo, em repositorio publico.
 *
 * Uso:  node database/migrations/migrate.js 030_arrival_confirmation_and_verified_backfill.sql
 *       node database/migrations/migrate.js <arquivo> --dry-run
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const arquivo = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!arquivo) {
    console.error('Informe o arquivo da migration.');
    console.error('  node database/migrations/migrate.js 030_arrival_confirmation_and_verified_backfill.sql');
    process.exit(1);
}

const caminho = path.isAbsolute(arquivo) ? arquivo : path.join(__dirname, arquivo);
if (!fs.existsSync(caminho)) {
    console.error(`Arquivo nao encontrado: ${caminho}`);
    process.exit(1);
}

const faltando = ['DB_HOST', 'DB_USERNAME', 'DB_DATABASE']
    .filter((k) => !process.env[k]);
if (faltando.length) {
    console.error(`Faltam variaveis de ambiente: ${faltando.join(', ')}`);
    console.error('Defina no .env ou exporte antes de rodar.');
    process.exit(1);
}

// separa os comandos, ignorando comentarios e linhas vazias
const sql = fs.readFileSync(caminho, 'utf8');
const comandos = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean);

const main = async () => {
    console.log(`migration: ${path.basename(caminho)}`);
    console.log(`banco:     ${process.env.DB_DATABASE} em ${process.env.DB_HOST}`);
    console.log(`comandos:  ${comandos.length}${dryRun ? '  (simulacao)' : ''}\n`);

    if (dryRun) {
        comandos.forEach((c, i) => console.log(`${i + 1}. ${c.split('\n')[0].slice(0, 90)}...`));
        return;
    }

    const conexao = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE,
        multipleStatements: false,
    });

    try {
        for (const [i, comando] of comandos.entries()) {
            const resumo = comando.split('\n')[0].slice(0, 80);
            try {
                const [r] = await conexao.query(comando);
                const linhas = r && r.affectedRows !== undefined ? ` (${r.affectedRows} linhas)` : '';
                console.log(`  ${i + 1}. ok${linhas}  ${resumo}`);
            } catch (e) {
                // repetir a migration nao pode quebrar o deploy
                if (['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(e.code)) {
                    console.log(`  ${i + 1}. ja aplicado  ${resumo}`);
                } else {
                    console.error(`  ${i + 1}. FALHOU  ${resumo}`);
                    throw e;
                }
            }
        }
        console.log('\nmigration concluida');
    } finally {
        await conexao.end();
    }
};

main().catch((e) => {
    console.error('\nerro:', e.message);
    process.exit(1);
});
