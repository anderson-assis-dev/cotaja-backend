const { pool } = require('../config/database');

/**
 * Mantem o selo de perfil verificado em dia.
 *
 * A coluna `is_verified` existe desde a migration 026 e e lida no card de
 * proposta e no status da assinatura, mas nenhum ponto do codigo a escrevia.
 * Um prestador podia ter passado pela checagem de antecedentes e pela prova de
 * vida e mesmo assim nunca receber o selo.
 *
 * Aqui o selo deixa de ser um campo solto e passa a ser derivado das duas
 * checagens que o proprio sistema ja faz, de modo que nao exista estado
 * intermediario para alguem esquecer de atualizar.
 */
const refreshIsVerified = async (userId) => {
    if (!userId) return null;
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(
            `SELECT profile_type, criminal_check, liveness_verified, is_verified
               FROM users WHERE id = ?`,
            [userId]
        );
        if (!rows.length) return null;

        const u = rows[0];
        const deveSerVerificado = u.profile_type === 'provider'
            && Number(u.criminal_check) === 1
            && Number(u.liveness_verified) === 1;
        const alvo = deveSerVerificado ? 1 : 0;

        if (Number(u.is_verified) === alvo) return alvo;

        await connection.execute(
            'UPDATE users SET is_verified = ?, updated_at = NOW() WHERE id = ?',
            [alvo, userId]
        );
        return alvo;
    } catch (error) {
        // nao bloqueia o fluxo de quem acabou de concluir uma verificacao
        console.error('Erro ao atualizar o selo de verificado:', error.message);
        return null;
    } finally {
        connection.release();
    }
};

module.exports = { refreshIsVerified };
