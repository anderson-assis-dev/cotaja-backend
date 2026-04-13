const { pool } = require('../config/database');
const PushNotificationService = require('./PushNotificationService');
const Notification = require('../models/Notification');

const COOLDOWNS = {
    client_open_order_48h:        2,
    client_unread_proposal_24h:   1,
    client_inactive_7d:           7,
    client_inactive_30d:          15,
    client_pending_rating:        3,
    provider_no_ad_3d:            7,
    provider_proposal_pending_5d: 5,
    provider_no_accepted_month:   10,
    provider_unused_credits:      7,
};

class DynamicNotificationService {
    constructor() {
        this.push = new PushNotificationService();
    }

    async _wasRecentlySent(userId, triggerType) {
        const cooldownDays = COOLDOWNS[triggerType] ?? 3;
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT id FROM notification_sent_log
                 WHERE user_id = ? AND trigger_type = ?
                   AND sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                 LIMIT 1`,
                [userId, triggerType, cooldownDays]
            );
            return rows.length > 0;
        } finally {
            connection.release();
        }
    }

    async _logSent(userId, triggerType) {
        const connection = await pool.getConnection();
        try {
            await connection.execute(
                `INSERT INTO notification_sent_log (user_id, trigger_type, sent_at)
                 VALUES (?, ?, NOW())`,
                [userId, triggerType]
            );
        } finally {
            connection.release();
        }
    }

    async _send(user, triggerType, title, message, data = {}) {
        if (await this._wasRecentlySent(user.id, triggerType)) return false;

        await Notification.create({
            user_id: user.id,
            type: triggerType,
            title,
            message,
            data,
        }).catch(err => console.error(`[DynNotif] Erro DB (${triggerType}):`, err.message));

        if (user.fcm_token) {
            await this.push.sendAlert({
                registration_id: user.fcm_token,
                device: user.device_platform || 'ios',
                title,
                message,
                sound: 'default',
                extra_data: { type: triggerType, ...data },
            }).catch(err => console.error(`[DynNotif] Erro push (${triggerType}) user ${user.id}:`, err.message));
        }

        await this._logSent(user.id, triggerType);
        console.log(`[DynNotif] ✅ ${triggerType} → user ${user.id} (${user.email})`);
        return true;
    }

    async checkClientOpenOrderWithoutProposals() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT u.id, u.email, u.fcm_token, u.device_platform, o.id AS order_id, o.title
                 FROM orders o
                 JOIN users u ON u.id = o.client_id
                 WHERE o.status = 'open'
                   AND o.created_at <= DATE_SUB(NOW(), INTERVAL 48 HOUR)
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                   AND (SELECT COUNT(*) FROM proposals p WHERE p.order_id = o.id) = 0`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_open_order_48h',
                    'Seu pedido ainda está no ar! 📋',
                    `"${row.title}" ainda não recebeu propostas. Prestadores estão vendo sua demanda!`,
                    { order_id: String(row.order_id) }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_open_order_48h: ${sent}/${rows.length} enviados`);
        } finally {
            connection.release();
        }
    }

    async checkClientUnreadProposal() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT DISTINCT u.id, u.email, u.fcm_token, u.device_platform,
                        o.id AS order_id, o.title,
                        COUNT(p.id) AS proposal_count
                 FROM proposals p
                 JOIN orders o ON o.id = p.order_id
                 JOIN users u ON u.id = o.client_id
                 JOIN notifications n ON n.user_id = u.id
                   AND n.type = 'new_proposal'
                   AND JSON_EXTRACT(n.data, '$.order_id') = p.order_id
                   AND n.read_at IS NULL
                   AND n.created_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                 WHERE p.status = 'pending'
                   AND o.status = 'open'
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                 GROUP BY u.id, o.id, o.title`
            );
            let sent = 0;
            for (const row of rows) {
                const count = row.proposal_count;
                const ok = await this._send(row, 'client_unread_proposal_24h',
                    `Você tem ${count > 1 ? count + ' propostas' : 'uma proposta'} esperando! 🔔`,
                    `Confira ${count > 1 ? 'as propostas' : 'a proposta'} para "${row.title}" e escolha o melhor prestador.`,
                    { order_id: String(row.order_id) }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_unread_proposal_24h: ${sent}/${rows.length} enviados`);
        } finally {
            connection.release();
        }
    }

    async checkClientInactive7Days() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT id, email, fcm_token, device_platform
                 FROM users
                 WHERE profile_type = 'client'
                   AND deleted_at IS NULL
                   AND fcm_token IS NOT NULL AND fcm_token != ''
                   AND (
                       last_active IS NULL AND created_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)
                       OR last_active <= DATE_SUB(NOW(), INTERVAL 7 DAY)
                   )`
            );
            const messages = [
                'Precisa de um serviço? Crie um pedido em menos de 2 minutos. ⚡',
                'Sua casa merece atenção! Encontre o profissional certo agora.',
                'Centenas de prestadores aguardam sua demanda na Cotaja. 🛠️',
            ];
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_inactive_7d',
                    'Está precisando de ajuda? 👋',
                    messages[row.id % messages.length],
                    {}
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_inactive_7d: ${sent}/${rows.length} enviados`);
        } finally {
            connection.release();
        }
    }

    async checkClientRetentionCycle() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT u.id, u.email, u.fcm_token, u.device_platform,
                        MAX(o.updated_at) AS last_order_date
                 FROM users u
                 JOIN orders o ON o.client_id = u.id AND o.status = 'completed'
                 WHERE u.profile_type = 'client'
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                 GROUP BY u.id, u.email, u.fcm_token, u.device_platform
                 HAVING last_order_date <= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    AND last_order_date >= DATE_SUB(NOW(), INTERVAL 60 DAY)`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_inactive_30d',
                    'Faz tempo que não te vemos! 🏠',
                    'Seu último serviço foi há mais de um mês. Precisa de algum profissional?',
                    {}
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_inactive_30d: ${sent}/${rows.length} enviados`);
        } finally {
            connection.release();
        }
    }

    async checkClientPendingRating() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT DISTINCT u.id, u.email, u.fcm_token, u.device_platform,
                        o.id AS order_id, o.title
                 FROM orders o
                 JOIN users u ON u.id = o.client_id
                 WHERE o.status = 'completed'
                   AND o.updated_at <= DATE_SUB(NOW(), INTERVAL 1 DAY)
                   AND o.updated_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                   AND NOT EXISTS (
                       SELECT 1 FROM provider_ratings pr
                       WHERE pr.order_id = o.id AND pr.client_id = u.id
                   )`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_pending_rating',
                    'Como foi o serviço? ⭐',
                    `Avalie o profissional de "${row.title}" e ajude outros clientes a escolher bem.`,
                    { order_id: String(row.order_id) }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_pending_rating: ${sent}/${rows.length} enviados`);
        } finally {
            connection.release();
        }
    }

    async checkProviderNoAdAfterRegistration() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT u.id, u.email, u.fcm_token, u.device_platform
                 FROM users u
                 WHERE u.profile_type = 'provider'
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                   AND u.created_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)
                   AND NOT EXISTS (
                       SELECT 1 FROM ad_purchases ap WHERE ap.user_id = u.id
                   )`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'provider_no_ad_3d',
                    'Atraia mais clientes com Cotaja Ads! 🚀',
                    'Prestadores com anúncio recebem até 3x mais contatos. Crie seu primeiro anúncio agora.',
                    { screen: 'wallet' }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] provider_no_ad_3d: ${sent}/${rows.length} enviados`);
        } finally {
            connection.release();
        }
    }

    async checkProviderProposalPending() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT DISTINCT u.id, u.email, u.fcm_token, u.device_platform,
                        COUNT(p.id) AS pending_count
                 FROM proposals p
                 JOIN users u ON u.id = p.provider_id
                 WHERE p.status = 'pending'
                   AND p.created_at <= DATE_SUB(NOW(), INTERVAL 5 DAY)
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                 GROUP BY u.id, u.email, u.fcm_token, u.device_platform`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'provider_proposal_pending_5d',
                    'Quer se destacar da concorrência? 🏆',
                    `Você tem ${row.pending_count} proposta(s) aguardando. Anuncie e apareça primeiro para os clientes!`,
                    { screen: 'wallet' }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] provider_proposal_pending_5d: ${sent}/${rows.length} enviados`);
        } finally {
            connection.release();
        }
    }

    async checkProviderNoAcceptedProposalThisMonth() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT u.id, u.email, u.fcm_token, u.device_platform
                 FROM users u
                 WHERE u.profile_type = 'provider'
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                   AND u.created_at <= DATE_SUB(NOW(), INTERVAL 15 DAY)
                   AND NOT EXISTS (
                       SELECT 1 FROM proposals p
                       WHERE p.provider_id = u.id
                         AND p.status = 'accepted'
                         AND p.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                   )`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'provider_no_accepted_month',
                    'Clientes estão buscando profissionais como você! 🔍',
                    'Com a Cotaja Ads você aparece nos resultados de busca e atrai mais clientes. Conheça os planos.',
                    { screen: 'wallet' }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] provider_no_accepted_month: ${sent}/${rows.length} enviados`);
        } finally {
            connection.release();
        }
    }

    async checkProviderUnusedAdCredits() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT u.id, u.email, u.fcm_token, u.device_platform,
                        SUM(ap.remaining_ads) AS total_credits
                 FROM ad_purchases ap
                 JOIN users u ON u.id = ap.user_id
                 WHERE ap.status = 'active'
                   AND ap.remaining_ads > 0
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                   AND NOT EXISTS (
                       SELECT 1 FROM ads a
                       WHERE a.user_id = u.id
                         AND a.status = 'pending'
                         AND a.scheduled_date >= CURDATE()
                   )
                 GROUP BY u.id, u.email, u.fcm_token, u.device_platform`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'provider_unused_credits',
                    `Você tem ${row.total_credits} crédito(s) de anúncio disponível! 💡`,
                    'Não deixe seus créditos parados. Programe um anúncio agora e alcance mais clientes hoje.',
                    { screen: 'wallet' }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] provider_unused_credits: ${sent}/${rows.length} enviados`);
        } finally {
            connection.release();
        }
    }

    async runAll() {
        console.log('[DynNotif] 🔁 Iniciando ciclo de notificações dinâmicas...');
        const start = Date.now();

        const results = await Promise.allSettled([
            this.checkClientOpenOrderWithoutProposals(),
            this.checkClientUnreadProposal(),
            this.checkClientInactive7Days(),
            this.checkClientRetentionCycle(),
            this.checkClientPendingRating(),
            this.checkProviderNoAdAfterRegistration(),
            this.checkProviderProposalPending(),
            this.checkProviderNoAcceptedProposalThisMonth(),
            this.checkProviderUnusedAdCredits(),
        ]);

        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.error(`[DynNotif] ❌ Task ${i} falhou:`, r.reason?.message);
            }
        });

        console.log(`[DynNotif] ✅ Ciclo concluído em ${Date.now() - start}ms`);
    }
}

module.exports = new DynamicNotificationService();
