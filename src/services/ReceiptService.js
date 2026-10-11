const crypto = require('crypto');
const { pool } = require('../config/database');

// Alfabeto sem 0, O, 1 e I, para que o codigo possa ser ditado por telefone
// sem gerar duvida de leitura.
const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const bloco = (n) => Array.from(crypto.randomBytes(n))
    .map((b) => ALFABETO[b % ALFABETO.length])
    .join('');

/** Codigo publico no formato CB-XXXX-XXXX, aleatorio e nao sequencial. */
const gerarCodigo = () => `CB-${bloco(4)}-${bloco(4)}`;

/**
 * Emite o comprovante de um pedido concluido.
 *
 * Idempotente: um pedido que ja tem codigo mantem o mesmo, para que um
 * comprovante compartilhado continue valido para sempre.
 */
const emitir = async (orderId) => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(
            'SELECT id, status, receipt_code FROM orders WHERE id = ?',
            [orderId]
        );
        if (!rows.length) return null;
        if (rows[0].status !== 'completed') return null;
        if (rows[0].receipt_code) return rows[0].receipt_code;

        // colisao e improvavel, mas o indice e unico e a retentativa e barata
        for (let tentativa = 0; tentativa < 5; tentativa += 1) {
            const codigo = gerarCodigo();
            try {
                await connection.execute(
                    'UPDATE orders SET receipt_code = ?, receipt_issued_at = NOW() WHERE id = ? AND receipt_code IS NULL',
                    [codigo, orderId]
                );
                const [conf] = await connection.execute(
                    'SELECT receipt_code FROM orders WHERE id = ?',
                    [orderId]
                );
                if (conf[0] && conf[0].receipt_code) return conf[0].receipt_code;
            } catch (e) {
                if (e.code !== 'ER_DUP_ENTRY') throw e;
            }
        }
        return null;
    } catch (error) {
        // a conclusao do servico nao pode falhar por causa do comprovante
        console.error('Erro ao emitir comprovante:', error.message);
        return null;
    } finally {
        connection.release();
    }
};

const SELECT_BASE = `
    SELECT o.id, o.title, o.description, o.category, o.brand, o.budget,
           o.address, o.street, o.number, o.complement, o.neighborhood,
           o.city, o.state, o.zip_code,
           o.status, o.created_at, o.scheduled_date,
           o.arrival_confirmed_at, o.arrival_confirmed_distance_km,
           o.updated_at AS completed_at,
           o.receipt_code, o.receipt_issued_at,
           o.client_id, o.provider_id,
           c.name AS client_name,
           p.name AS provider_name, p.is_verified AS provider_verified,
           p.criminal_check_date AS provider_check_date,
           pr.price AS accepted_price, pr.deadline AS accepted_deadline
      FROM orders o
      LEFT JOIN users c ON c.id = o.client_id
      LEFT JOIN users p ON p.id = o.provider_id
      LEFT JOIN proposals pr ON pr.id = o.accepted_proposal_id
`;

/**
 * Monta o comprovante.
 *
 * `publico` controla o nivel de detalhe: quem abre pelo codigo ve o suficiente
 * para conferir que o servico existiu, sem o endereco exato do cliente, porque
 * o link pode circular fora das duas partes.
 */
const montar = (row, { publico = false } = {}) => {
    if (!row) return null;

    const endereco = publico
        ? [row.neighborhood, row.city, row.state].filter(Boolean).join(', ')
        : row.address || [row.street, row.number, row.neighborhood, row.city, row.state]
            .filter(Boolean).join(', ');

    return {
        codigo: row.receipt_code,
        marca: row.brand || 'cotaja',
        emitido_em: row.receipt_issued_at,
        servico: {
            titulo: row.title,
            categoria: row.category,
            descricao: publico ? null : row.description,
        },
        local: endereco,
        cliente: { nome: row.client_name },
        profissional: {
            nome: row.provider_name,
            verificado: Number(row.provider_verified) === 1,
            verificado_em: row.provider_check_date,
        },
        valor: row.accepted_price != null ? Number(row.accepted_price) : null,
        prazo_dias: row.accepted_deadline != null ? Number(row.accepted_deadline) : null,
        datas: {
            pedido_em: row.created_at,
            agendado_para: row.scheduled_date,
            chegada_confirmada_em: row.arrival_confirmed_at,
            concluido_em: row.completed_at,
        },
        chegada_validada_por_gps: row.arrival_confirmed_at != null,
        distancia_na_confirmacao_km: row.arrival_confirmed_distance_km != null
            ? Number(row.arrival_confirmed_distance_km) : null,
    };
};

/** Comprovante de um pedido, para o cliente ou o prestador daquele pedido. */
const porPedido = async (orderId) => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(`${SELECT_BASE} WHERE o.id = ?`, [orderId]);
        return rows[0] || null;
    } finally {
        connection.release();
    }
};

/** Comprovante pelo codigo publico, para conferencia por terceiros. */
const porCodigo = async (codigo) => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(
            `${SELECT_BASE} WHERE o.receipt_code = ?`,
            [String(codigo).trim().toUpperCase()]
        );
        return rows[0] || null;
    } finally {
        connection.release();
    }
};

module.exports = { gerarCodigo, emitir, montar, porPedido, porCodigo };
