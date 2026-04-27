const { pool } = require('../config/database');
const CriminalCheckService = require('./CriminalCheckService');

const COOLDOWN_HOURS = 4;

class CriminalCheckCron {
  constructor() {
    this.intervalId = null;
    this.running = false;
    this.rateLimitedUntil = null;
  }

  start(intervalMs = 60 * 60 * 1000) {
    console.log('[CriminalCheckCron] Iniciado (intervalo: 1h)');
    this.intervalId = setInterval(() => this.run(), intervalMs);
    setTimeout(() => this.run(), 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async run() {
    if (this.running) {
      console.log('[CriminalCheckCron] Já está rodando, pulando...');
      return;
    }

    this.running = true;
    console.log('[CriminalCheckCron] Verificando prestadores pendentes...');

    if (this.rateLimitedUntil && Date.now() < this.rateLimitedUntil) {
      const remaining = Math.round((this.rateLimitedUntil - Date.now()) / 60000);
      console.log(`[CriminalCheckCron] Rate limited pela PF, aguardando mais ${remaining} min`);
      this.running = false;
      return;
    }
    this.rateLimitedUntil = null;

    let connection;
    try {
      connection = await pool.getConnection();

      const [rows] = await connection.execute(
        `SELECT id, name, cpf, mother_name, birth_date
         FROM users
         WHERE profile_type = 'provider'
           AND criminal_check = 0
           AND cpf IS NOT NULL
           AND cpf != ''
           AND mother_name IS NOT NULL
           AND mother_name != ''
           AND birth_date IS NOT NULL
         ORDER BY created_at ASC
         LIMIT 5`
      );

      connection.release();
      connection = null;

      if (rows.length === 0) {
        console.log('[CriminalCheckCron] Nenhum prestador pendente.');
        this.running = false;
        return;
      }

      console.log(`[CriminalCheckCron] ${rows.length} prestador(es) pendente(s)`);

      for (const user of rows) {
        const cpfDigits = (user.cpf || '').replace(/\D/g, '');
        if (cpfDigits.length > 11) {
          console.log(`[CriminalCheckCron] ${user.name} - CNPJ, marcando como isento`);
          const conn = await pool.getConnection();
          try {
            await conn.execute(
              `UPDATE users SET criminal_check = 1, criminal_check_code = 'CNPJ_ISENTO', criminal_check_date = NOW() WHERE id = ?`,
              [user.id]
            );
          } finally {
            conn.release();
          }
          continue;
        }

        console.log(`[CriminalCheckCron] Processando: ${user.name} (ID: ${user.id})`);
        try {
          const result = await CriminalCheckService.checkProvider(user.id);
          console.log(`[CriminalCheckCron] ${user.name} -> ${result.criminal_check_code || 'ERRO'}`);
        } catch (error) {
          if (error.code === 'RATE_LIMITED') {
            this.rateLimitedUntil = Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000;
            console.error(`[CriminalCheckCron] PF rate limit atingido! Pausando por ${COOLDOWN_HOURS}h (até ${new Date(this.rateLimitedUntil).toISOString()})`);
            break;
          }
          console.error(`[CriminalCheckCron] Erro ao processar ${user.name}:`, error.message, error.stack);
        }

        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (error) {
      console.error('[CriminalCheckCron] Erro geral:', error.message, error.stack);
    } finally {
      if (connection) connection.release();
      this.running = false;
    }
  }
}

module.exports = new CriminalCheckCron();
