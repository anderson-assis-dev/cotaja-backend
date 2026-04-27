const { pool } = require('../config/database');
const PushNotificationService = require('./PushNotificationService');
const Notification = require('../models/Notification');
const emailService = require('./EmailService');

const DAILY_CAP = 2;

const MARKETING_TRIGGERS = new Set([
    'client_daily_inspire',
    'provider_daily_grow',
    'client_inactive_7d',
    'client_inactive_30d',
    'provider_no_ad_3d',
    'provider_no_accepted_month',
    'provider_proposal_pending_5d',
    'provider_unused_credits',
    'provider_profile_incomplete',
    'client_order_completed_no_reorder',
]);

const EMAIL_TRIGGERS = {
    client_welcome_first_order:        { subject: 'Bem-vindo à Cotaja! Crie seu primeiro pedido', cta: 'Criar meu primeiro pedido', screen: 'new-order' },
    client_proposal_about_to_expire:   { subject: 'Suas propostas vencem em breve!', cta: 'Ver propostas agora', screen: 'order' },
    client_pending_rating:             { subject: 'Avalie o profissional do seu serviço ⭐', cta: 'Avaliar profissional', screen: 'rate' },
    client_order_completed_no_reorder: { subject: 'Precisa de um profissional novamente?', cta: 'Criar novo pedido', screen: 'new-order' },
    provider_profile_incomplete:       { subject: 'Complete seu perfil e atraia mais clientes', cta: 'Completar perfil', screen: 'profile' },
};

const COOLDOWNS = {
    client_open_order_48h:            2,
    client_unread_proposal_24h:       1,
    client_inactive_7d:               7,
    client_inactive_30d:              15,
    client_pending_rating:            3,
    client_welcome_first_order:       1,
    client_proposal_about_to_expire:  2,
    client_proposal_expiring:         5,
    client_order_completed_no_reorder: 14,
    client_daily_inspire:             7,
    provider_daily_grow:              7,
    provider_no_ad_3d:                7,
    provider_proposal_pending_5d:     5,
    provider_no_accepted_month:       10,
    provider_unused_credits:          7,
    provider_profile_incomplete:      1,
};

class DynamicNotificationService {
    constructor() {
        this.push = new PushNotificationService();
    }

    async _isDailyCapReached(userId) {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) AS total FROM notification_sent_log
             WHERE user_id = ? AND sent_at >= CURDATE()`,
            [userId]
        );
        return rows[0].total >= DAILY_CAP;
    }

    async _wasRecentlySent(userId, triggerType) {
        const cooldownDays = COOLDOWNS[triggerType] ?? 3;
        const [rows] = await pool.execute(
            `SELECT id FROM notification_sent_log
             WHERE user_id = ? AND trigger_type = ?
               AND sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             LIMIT 1`,
            [userId, triggerType, cooldownDays]
        );
        return rows.length > 0;
    }

    async _logSent(userId, triggerType) {
        await pool.execute(
            `INSERT INTO notification_sent_log (user_id, trigger_type, sent_at)
             VALUES (?, ?, NOW())`,
            [userId, triggerType]
        );
    }

    async _send(user, triggerType, title, message, data = {}) {
        if (await this._wasRecentlySent(user.id, triggerType)) return false;

        // Marketing triggers respeitam o cap diário; transacionais passam sempre
        if (MARKETING_TRIGGERS.has(triggerType) && await this._isDailyCapReached(user.id)) return false;

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

        const emailConfig = EMAIL_TRIGGERS[triggerType];
        if (emailConfig && user.email) {
            const baseUrl = process.env.APP_URL || 'https://api.cotaja.io';
            let ctaUrl = `${baseUrl}/open?screen=${emailConfig.screen}`;
            if (data.order_id) ctaUrl += `&id=${data.order_id}`;

            await emailService.sendGenericNotification(
                user,
                emailConfig.subject,
                title,
                message,
                emailConfig.cta,
                ctaUrl,
            ).catch(err => console.error(`[DynNotif] Erro email (${triggerType}) user ${user.id}:`, err.message));
        }

        await this._logSent(user.id, triggerType);
        console.log(`[DynNotif] ✅ ${triggerType} → user ${user.id} (${user.email})`);
        return true;
    }

    async checkClientOpenOrderWithoutProposals() {
        const [rows] = await pool.execute(
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
    }

    async checkClientUnreadProposal() {
        const [rows] = await pool.execute(
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
    }

    async checkClientInactive7Days() {
        const [rows] = await pool.execute(
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
                'Centenas de prestadores aguardam sua demanda no CotaJá. 🛠️',
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
    }

    async checkClientRetentionCycle() {
        const [rows] = await pool.execute(
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
    }

    async checkClientPendingRating() {
        const [rows] = await pool.execute(
                `SELECT DISTINCT u.id, u.name, u.email, u.fcm_token, u.device_platform,
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
                       WHERE pr.provider_id = o.provider_id AND pr.client_id = u.id
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
    }

    async checkProviderNoAdAfterRegistration() {
        const [rows] = await pool.execute(
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
    }

    async checkProviderProposalPending() {
        const [rows] = await pool.execute(
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
    }

    async checkProviderNoAcceptedProposalThisMonth() {
        const [rows] = await pool.execute(
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
    }

    async checkClientWelcomeFirstOrder() {
        const [rows] = await pool.execute(
                `SELECT id, name, email, fcm_token, device_platform
                 FROM users
                 WHERE profile_type = 'client'
                   AND deleted_at IS NULL
                   AND fcm_token IS NOT NULL AND fcm_token != ''
                   AND created_at <= DATE_SUB(NOW(), INTERVAL 2 DAY)
                   AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                   AND NOT EXISTS (
                       SELECT 1 FROM orders o WHERE o.client_id = users.id
                   )`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_welcome_first_order',
                    'Bem-vindo à Cotaja! Crie seu primeiro pedido 🎉',
                    'Encontre profissionais qualificados perto de você em minutos. É rápido e gratuito!',
                    { screen: 'new_order' }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_welcome_first_order: ${sent}/${rows.length} enviados`);
    }

    async checkClientProposalAboutToExpire() {
        const [rows] = await pool.execute(
                `SELECT DISTINCT u.id, u.name, u.email, u.fcm_token, u.device_platform,
                        o.id AS order_id, o.title,
                        COUNT(p.id) AS proposal_count
                 FROM proposals p
                 JOIN orders o ON o.id = p.order_id
                 JOIN users u ON u.id = o.client_id
                 WHERE p.status = 'pending'
                   AND o.status = 'open'
                   AND p.created_at <= DATE_SUB(NOW(), INTERVAL 6 DAY)
                   AND p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                 GROUP BY u.id, o.id, o.title`
            );
            let sent = 0;
            for (const row of rows) {
                const count = row.proposal_count;
                const ok = await this._send(row, 'client_proposal_about_to_expire',
                    'Suas propostas vencem em breve! ⏳',
                    `${count > 1 ? count + ' propostas' : 'Uma proposta'} para "${row.title}" ${count > 1 ? 'vencem' : 'vence'} em menos de 24h. Não perca!`,
                    { order_id: String(row.order_id) }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_proposal_about_to_expire: ${sent}/${rows.length} enviados`);
    }

    async checkClientProposalExpiring() {
        const [rows] = await pool.execute(
                `SELECT u.id, u.email, u.fcm_token, u.device_platform,
                        o.id AS order_id, o.title
                 FROM orders o
                 JOIN users u ON u.id = o.client_id
                 WHERE o.status = 'in_progress'
                   AND o.updated_at <= DATE_SUB(NOW(), INTERVAL 5 DAY)
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_proposal_expiring',
                    'Como está andando seu serviço? 🔧',
                    `O pedido "${row.title}" está em andamento há alguns dias. Tudo certo com o profissional?`,
                    { order_id: String(row.order_id) }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_proposal_expiring: ${sent}/${rows.length} enviados`);
    }

    async checkClientOrderCompletedNoReorder() {
        const [rows] = await pool.execute(
                `SELECT u.id, u.name, u.email, u.fcm_token, u.device_platform,
                        MAX(o.updated_at) AS last_completed_at
                 FROM users u
                 JOIN orders o ON o.client_id = u.id AND o.status = 'completed'
                 WHERE u.profile_type = 'client'
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                 GROUP BY u.id, u.email, u.fcm_token, u.device_platform
                 HAVING last_completed_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    AND last_completed_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
                    AND NOT EXISTS (
                        SELECT 1 FROM orders o2
                        WHERE o2.client_id = u.id
                          AND o2.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    )`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_order_completed_no_reorder',
                    'Precisa de um profissional novamente? 🏠',
                    'Você já usou a Cotaja antes e adorou! Abra um novo pedido e encontre o profissional certo.',
                    { screen: 'new_order' }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_order_completed_no_reorder: ${sent}/${rows.length} enviados`);
    }

    async checkProviderProfileIncomplete() {
        const [rows] = await pool.execute(
                `SELECT u.id, u.name, u.email, u.fcm_token, u.device_platform,
                        (u.avatar_base64 IS NULL OR u.avatar_base64 = '') AS missing_avatar,
                        (SELECT COUNT(*) FROM services s WHERE s.provider_id = u.id AND s.status = 'active') AS service_count
                 FROM users u
                 WHERE u.profile_type = 'provider'
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                   AND u.created_at <= DATE_SUB(NOW(), INTERVAL 2 DAY)
                   AND (
                       u.avatar_base64 IS NULL OR u.avatar_base64 = ''
                       OR NOT EXISTS (
                           SELECT 1 FROM services s
                           WHERE s.provider_id = u.id AND s.status = 'active'
                       )
                   )`
            );
            let sent = 0;
            for (const row of rows) {
                const missing = [];
                if (row.missing_avatar) missing.push('foto de perfil');
                if (row.service_count === 0) missing.push('serviços cadastrados');
                const missingText = missing.join(' e ');

                const ok = await this._send(row, 'provider_profile_incomplete',
                    'Seu perfil está incompleto! 📝',
                    `Adicione ${missingText} para transmitir mais confiança e atrair mais clientes.`,
                    { screen: 'profile' }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] provider_profile_incomplete: ${sent}/${rows.length} enviados`);
    }

    async checkClientDailyInspire() {
        const [rows] = await pool.execute(
                `SELECT id, email, fcm_token, device_platform
                 FROM users
                 WHERE profile_type = 'client'
                   AND deleted_at IS NULL
                   AND activate = 1
                   AND fcm_token IS NOT NULL AND fcm_token != ''
                   AND (last_active IS NULL OR last_active <= DATE_SUB(NOW(), INTERVAL 3 DAY))`
            );

            const messages = [
                { title: 'Precisa de uma mão hoje? 🤝', body: 'No CotaJá você encontra profissionais verificados perto de você. Crie um pedido em menos de 2 minutos!' },
                { title: 'Seu lar merece cuidado! 🏠', body: 'De elétrica a limpeza, a Cotaja conecta você aos melhores profissionais da sua região.' },
                { title: 'Economize tempo e dinheiro 💰', body: 'Receba propostas de vários profissionais e escolha a melhor oferta. Só no CotaJá!' },
                { title: 'Um profissional perto de você 📍', body: 'Centenas de prestadores qualificados aguardam seu pedido. Qual serviço você precisa hoje?' },
                { title: 'Serviço feito do jeito certo ✅', body: 'No CotaJá você contrata com segurança, avalia o profissional e garante a qualidade do serviço.' },
                { title: 'Não deixe para depois! ⚡', body: 'Aquele serviço que você está adiando pode ser resolvido hoje. Abra um pedido agora!' },
                { title: 'Profissionais prontos para te atender 🛠️', body: 'Peça orçamentos gratuitos e sem compromisso para qualquer serviço. Experimente agora!' },
            ];

            const dayIndex = new Date().getDay();
            const { title, body } = messages[dayIndex % messages.length];

            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_daily_inspire', title, body, { screen: 'new_order' });
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_daily_inspire: ${sent}/${rows.length} enviados`);
    }

    async checkProviderDailyGrow() {
        const [rows] = await pool.execute(
                `SELECT id, email, fcm_token, device_platform
                 FROM users
                 WHERE profile_type = 'provider'
                   AND deleted_at IS NULL
                   AND activate = 1
                   AND fcm_token IS NOT NULL AND fcm_token != ''
                   AND (last_active IS NULL OR last_active <= DATE_SUB(NOW(), INTERVAL 3 DAY))`
            );

            const messages = [
                { title: 'Aumente seu faturamento hoje! 🚀', body: 'Clientes estão buscando profissionais como você agora. Veja os pedidos disponíveis no CotaJá!' },
                { title: 'Novos pedidos te aguardam 📋', body: 'Quanto mais propostas você enviar, mais chances de fechar novos contratos. Acesse agora!' },
                { title: 'Seu próximo cliente está no CotaJá 🔍', body: 'Profissionais ativos na plataforma faturam até 3x mais. Não perca as oportunidades de hoje!' },
                { title: 'Destaque-se da concorrência 🏆', body: 'Complete seu perfil, peça avaliações e anuncie para aparecer primeiro nos resultados.' },
                { title: 'Sua agenda pode estar mais cheia 📅', body: 'Envie propostas competitivas hoje e garanta mais serviços para a semana. Veja os pedidos!' },
                { title: 'Construa sua reputação no CotaJá ⭐', body: 'Cada serviço bem feito é uma avaliação positiva. Mais avaliações = mais clientes = mais renda.' },
                { title: 'O fim de semana pode ser lucrativo 💵', body: 'Muitos clientes buscam serviços nos fins de semana. Fique ativo e aproveite a demanda!' },
            ];

            const dayIndex = new Date().getDay();
            const { title, body } = messages[dayIndex % messages.length];

            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'provider_daily_grow', title, body, { screen: 'orders' });
                if (ok) sent++;
            }
            console.log(`[DynNotif] provider_daily_grow: ${sent}/${rows.length} enviados`);
    }

    async checkProviderUnusedAdCredits() {
        const [rows] = await pool.execute(
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
            this.checkClientWelcomeFirstOrder(),
            this.checkClientProposalAboutToExpire(),
            this.checkClientProposalExpiring(),
            this.checkClientOrderCompletedNoReorder(),
            this.checkClientDailyInspire(),
            this.checkProviderDailyGrow(),
            this.checkProviderNoAdAfterRegistration(),
            this.checkProviderProposalPending(),
            this.checkProviderNoAcceptedProposalThisMonth(),
            this.checkProviderUnusedAdCredits(),
            this.checkProviderProfileIncomplete(),
        ]);

        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.error(`[DynNotif] ❌ Task ${i} falhou:`, r.reason?.message, r.reason?.stack);
            }
        });

        console.log(`[DynNotif] ✅ Ciclo concluído em ${Date.now() - start}ms`);
    }
}

module.exports = new DynamicNotificationService();
