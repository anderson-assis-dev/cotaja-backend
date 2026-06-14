const { pool } = require('../config/database');
const PushNotificationService = require('./PushNotificationService');
const Notification = require('../models/Notification');
const emailService = require('./EmailService');
const { buildDeepLink, buildHttpsLink } = require('../controllers/DeepLinkController');

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
    'client_order_cancelled_recovery',
    'client_seasonal_reactivation',
    'client_become_affiliate',
    'client_onboarding_d1',
    'client_onboarding_d3',
    'client_onboarding_d7',
]);

// Todos os gatilhos enviam push (quando há fcm_token) E e-mail. O `screen` define o
// destino do CTA; `url` (opcional) sobrepõe o link para um endereço externo.
const EMAIL_TRIGGERS = {
    client_open_order_48h:             { subject: 'Seu pedido ainda não recebeu propostas', cta: 'Ver meu pedido', screen: 'order' },
    client_unread_proposal_24h:        { subject: 'Você tem propostas esperando! 🔔', cta: 'Ver propostas', screen: 'order' },
    client_inactive_7d:                { subject: 'Está precisando de ajuda?', cta: 'Criar pedido', screen: 'new-order' },
    client_inactive_30d:               { subject: 'Faz tempo que não te vemos!', cta: 'Criar pedido', screen: 'new-order' },
    client_pending_rating:             { subject: 'Avalie o profissional do seu serviço ⭐', cta: 'Avaliar profissional', screen: 'rate' },
    client_welcome_first_order:        { subject: 'Bem-vindo à Cotaja! Crie seu primeiro pedido', cta: 'Criar meu primeiro pedido', screen: 'new-order' },
    client_proposal_about_to_expire:   { subject: 'Suas propostas vencem em breve!', cta: 'Ver propostas agora', screen: 'order' },
    client_proposal_expiring:          { subject: 'Como está andando seu serviço?', cta: 'Ver pedido', screen: 'order' },
    client_order_completed_no_reorder: { subject: 'Precisa de um profissional novamente?', cta: 'Criar novo pedido', screen: 'new-order' },
    client_daily_inspire:              { subject: 'Resolva aquele serviço hoje no CotaJá', cta: 'Criar pedido', screen: 'new-order' },
    client_order_cancelled_recovery:   { subject: 'Mudou de ideia? Vamos resolver', cta: 'Recriar pedido', screen: 'new-order' },
    client_seasonal_reactivation:      { subject: 'Que tal resolver aquele serviço?', cta: 'Ver profissionais', screen: 'new-order' },
    client_better_proposal:            { subject: 'Chegou uma proposta mais barata! 💰', cta: 'Ver proposta', screen: 'order' },
    client_unread_chat_message:        { subject: 'Você tem mensagens não lidas 💬', cta: 'Abrir conversa', screen: 'chat' },
    client_become_affiliate:           { subject: 'Indique o CotaJá e ganhe dinheiro', cta: 'Quero indicar', url: 'https://cotaja.io/afiliados' },
    client_onboarding_d1:              { subject: 'Bem-vindo ao CotaJá! Seus primeiros passos', cta: 'Começar agora', screen: 'new-order' },
    client_onboarding_d3:              { subject: 'Crie seu primeiro pedido em 2 minutos', cta: 'Criar pedido', screen: 'new-order' },
    client_onboarding_d7:              { subject: 'Contrate com segurança no CotaJá', cta: 'Explorar o app', screen: 'new-order' },
    provider_profile_incomplete:       { subject: 'Complete seu perfil e atraia mais clientes', cta: 'Adicionar serviço', screen: 'add-service' },
    provider_daily_grow:               { subject: 'Novos pedidos te aguardam no CotaJá', cta: 'Ver pedidos', screen: 'orders' },
    provider_no_ad_3d:                 { subject: 'Atraia mais clientes com Cotaja Ads', cta: 'Criar anúncio', screen: 'wallet' },
    provider_proposal_pending_5d:      { subject: 'Destaque-se da concorrência', cta: 'Anunciar agora', screen: 'wallet' },
    provider_no_accepted_month:        { subject: 'Clientes estão te buscando', cta: 'Conhecer planos', screen: 'wallet' },
    provider_unused_credits:           { subject: 'Você tem créditos de anúncio parados', cta: 'Programar anúncio', screen: 'wallet' },
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
    web_welcome_download_app:         1,
    client_order_cancelled_recovery:  7,
    client_seasonal_reactivation:     30,
    client_better_proposal:           1,
    client_unread_chat_message:       1,
    client_become_affiliate:          30,
    client_onboarding_d1:             30,
    client_onboarding_d3:             30,
    client_onboarding_d7:             30,
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

    async _isEmailUnsubscribed(userId) {
        try {
            const [rows] = await pool.execute(
                'SELECT email_unsubscribed FROM users WHERE id = ? LIMIT 1',
                [userId]
            );
            return rows.length > 0 && Number(rows[0].email_unsubscribed) === 1;
        } catch (err) {
            // Coluna ainda não migrada ou erro: não bloqueia o envio.
            return false;
        }
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

        // Deep link de destino: usa o campo `screen` quando presente; senão, se há
        // um order_id, abre o detalhe do pedido.
        const deeplink = data.screen
            ? buildDeepLink(data.screen, data.order_id)
            : (data.order_id ? buildDeepLink('order', data.order_id) : null);

        await Notification.create({
            user_id: user.id,
            type: triggerType,
            title,
            message,
            data: deeplink ? { ...data, deeplink } : data,
        }).catch(err => console.error(`[DynNotif] Erro DB (${triggerType}):`, err.message));

        if (user.fcm_token) {
            await this.push.sendAlert({
                registration_id: user.fcm_token,
                device: user.device_platform || 'ios',
                title,
                message,
                sound: 'default',
                extra_data: { type: triggerType, ...data, ...(deeplink ? { deeplink } : {}) },
            }).catch(err => console.error(`[DynNotif] Erro push (${triggerType}) user ${user.id}:`, err.message));
        }

        const emailConfig = EMAIL_TRIGGERS[triggerType];
        if (emailConfig && user.email && !(await this._isEmailUnsubscribed(user.id))) {
            const ctaUrl = emailConfig.url || buildHttpsLink(emailConfig.screen, data.order_id);

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
                    { order_id: String(row.order_id), screen: 'rate' }
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
                    { screen: 'add-service' }
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

    async checkWebUserWelcomeDownloadApp() {
        const [rows] = await pool.execute(
            `SELECT id, name, email, profile_type
             FROM users
             WHERE deleted_at IS NULL
               AND activate = 1
               AND email NOT LIKE 'deleted_%@deleted.invalid'
               AND (fcm_token IS NULL OR fcm_token = '')
               AND created_at <= DATE_SUB(NOW(), INTERVAL 2 HOUR)`
        );
        let sent = 0;
        for (const row of rows) {
            if (await this._wasRecentlySent(row.id, 'web_welcome_download_app')) continue;
            if (await this._isEmailUnsubscribed(row.id)) continue;
            try {
                await emailService.sendWebWelcomeDownloadApp(row);
                await this._logSent(row.id, 'web_welcome_download_app');
                sent++;
                console.log(`[DynNotif] ✅ web_welcome_download_app → user ${row.id} (${row.email})`);
            } catch (err) {
                console.error(`[DynNotif] Erro email (web_welcome_download_app) user ${row.id}:`, err.message);
            }
        }
        console.log(`[DynNotif] web_welcome_download_app: ${sent}/${rows.length} enviados`);
    }

    async checkClientOrderCancelledRecovery() {
        const [rows] = await pool.execute(
                `SELECT u.id, u.name, u.email, u.fcm_token, u.device_platform,
                        o.id AS order_id, o.title
                 FROM orders o
                 JOIN users u ON u.id = o.client_id
                 WHERE o.status = 'cancelled'
                   AND o.updated_at <= DATE_SUB(NOW(), INTERVAL 1 DAY)
                   AND o.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                   AND NOT EXISTS (
                       SELECT 1 FROM orders o2
                       WHERE o2.client_id = u.id
                         AND o2.status IN ('open', 'in_progress')
                         AND o2.created_at > o.updated_at
                   )
                 GROUP BY u.id, o.id, o.title`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_order_cancelled_recovery',
                    'Mudou de ideia? Vamos resolver! 🔄',
                    `Seu pedido "${row.title}" foi cancelado. Que tal recriá-lo e receber novas propostas de profissionais?`,
                    { screen: 'new_order' }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_order_cancelled_recovery: ${sent}/${rows.length} enviados`);
    }

    async checkClientSeasonalReactivation() {
        const [rows] = await pool.execute(
                `SELECT id, name, email, fcm_token, device_platform
                 FROM users
                 WHERE profile_type = 'client'
                   AND deleted_at IS NULL
                   AND email NOT LIKE 'deleted_%@deleted.invalid'
                   AND (
                       last_active IS NULL AND created_at <= DATE_SUB(NOW(), INTERVAL 14 DAY)
                       OR last_active <= DATE_SUB(NOW(), INTERVAL 14 DAY)
                   )`
            );
            const seasonal = [
                { title: 'Comece o ano com a casa em ordem 🏠', body: 'Janeiro é a época perfeita para organizar e reformar. Encontre profissionais para o que precisar!' },
                { title: 'Prepare sua casa para o Carnaval 🎉', body: 'Antes da folia, deixe tudo pronto: limpeza, reparos e muito mais com profissionais do CotaJá.' },
                { title: 'Outono chegou: hora da manutenção 🍂', body: 'Aproveite o clima ameno para reparos e melhorias. Receba orçamentos gratuitos no CotaJá.' },
                { title: 'Renove seu espaço neste mês 🌿', body: 'Pintura, jardinagem ou aquela reforma adiada? Profissionais qualificados estão a um clique.' },
                { title: 'Prepare-se para o frio ❄️', body: 'Revisão de aquecedores, isolamento e manutenção. Encontre quem resolve no CotaJá.' },
                { title: 'Festas juninas e a casa cheia? 🎪', body: 'Deixe tudo pronto para receber. Limpeza, decoração e reparos com profissionais avaliados.' },
                { title: 'Aproveite as férias para reformar 🛠️', body: 'Julho é mês de colocar a casa em dia. Receba propostas competitivas no CotaJá.' },
                { title: 'Manutenção do ar antes do calor ☀️', body: 'A primavera está chegando! Faça a revisão do ar-condicionado com profissionais de confiança.' },
                { title: 'Primavera: hora de renovar 🌷', body: 'Jardinagem, pintura e aquela repaginada na casa. Encontre profissionais perto de você.' },
                { title: 'Prepare a casa para as festas 🎄', body: 'Decoração, limpeza pesada e reparos de fim de ano. Garanta tudo pronto com o CotaJá.' },
                { title: 'Reta final do ano: resolva pendências 📋', body: 'Aquele serviço que ficou para depois? Ainda dá tempo! Receba orçamentos agora.' },
                { title: 'Casa pronta para o Natal e Ano Novo 🎁', body: 'Receba bem quem você ama. Limpeza, reformas e decoração com profissionais do CotaJá.' },
            ];
            const { title, body } = seasonal[new Date().getMonth()];
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_seasonal_reactivation', title, body, { screen: 'new_order' });
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_seasonal_reactivation: ${sent}/${rows.length} enviados`);
    }

    async checkClientBetterProposal() {
        const [rows] = await pool.execute(
                `SELECT u.id, u.name, u.email, u.fcm_token, u.device_platform,
                        o.id AS order_id, o.title, np.price AS new_price
                 FROM orders o
                 JOIN users u ON u.id = o.client_id
                 JOIN proposals np ON np.order_id = o.id AND np.status = 'pending'
                 WHERE o.status = 'open'
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                   AND np.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
                   AND np.created_at = (
                       SELECT MAX(p3.created_at) FROM proposals p3
                       WHERE p3.order_id = o.id AND p3.status = 'pending'
                   )
                   AND np.price < (
                       SELECT MIN(p2.price) FROM proposals p2
                       WHERE p2.order_id = o.id AND p2.id <> np.id AND p2.status = 'pending'
                   )
                 GROUP BY u.id, o.id, o.title, np.price`
            );
            let sent = 0;
            for (const row of rows) {
                const priceFmt = Number(row.new_price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const ok = await this._send(row, 'client_better_proposal',
                    'Chegou uma proposta mais barata! 💰',
                    `Você recebeu uma nova proposta de R$ ${priceFmt} para "${row.title}" — a melhor oferta até agora. Confira!`,
                    { order_id: String(row.order_id) }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_better_proposal: ${sent}/${rows.length} enviados`);
    }

    async checkClientUnreadChatMessage() {
        const [rows] = await pool.execute(
                `SELECT u.id, u.name, u.email, u.fcm_token, u.device_platform,
                        o.id AS order_id, o.title, COUNT(m.id) AS unread
                 FROM messages m
                 JOIN orders o ON o.id = m.order_id
                 JOIN users u ON u.id = o.client_id
                 WHERE m.receiver_id = CAST(u.id AS CHAR)
                   AND m.read_at IS NULL
                   AND m.created_at <= DATE_SUB(NOW(), INTERVAL 2 HOUR)
                   AND m.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                   AND u.deleted_at IS NULL
                   AND u.fcm_token IS NOT NULL AND u.fcm_token != ''
                 GROUP BY u.id, o.id, o.title`
            );
            let sent = 0;
            for (const row of rows) {
                const count = row.unread;
                const ok = await this._send(row, 'client_unread_chat_message',
                    `Você tem ${count > 1 ? count + ' mensagens' : 'uma mensagem'} não lida 💬`,
                    `O profissional do pedido "${row.title}" te enviou ${count > 1 ? 'mensagens' : 'uma mensagem'}. Responda para não perder o contato!`,
                    { order_id: String(row.order_id), screen: 'chat' }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_unread_chat_message: ${sent}/${rows.length} enviados`);
    }

    async checkClientBecomeAffiliate() {
        const [rows] = await pool.execute(
                `SELECT u.id, u.name, u.email, u.fcm_token, u.device_platform
                 FROM users u
                 WHERE u.profile_type = 'client'
                   AND u.deleted_at IS NULL
                   AND u.email NOT LIKE 'deleted_%@deleted.invalid'
                   AND NOT EXISTS (SELECT 1 FROM affiliates a WHERE a.user_id = u.id)
                   AND EXISTS (
                       SELECT 1 FROM orders o
                       WHERE o.client_id = u.id AND o.status = 'completed'
                   )`
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, 'client_become_affiliate',
                    'Indique o CotaJá e ganhe dinheiro 💸',
                    'Você já conhece o CotaJá! Indique para amigos pelo seu link e ganhe comissões a cada novo usuário. Saque via Pix.',
                    { screen: 'affiliate' }
                );
                if (ok) sent++;
            }
            console.log(`[DynNotif] client_become_affiliate: ${sent}/${rows.length} enviados`);
    }

    async checkClientOnboardingStages() {
        const stages = [
            {
                trigger: 'client_onboarding_d1', minDays: 1, maxDays: 2,
                title: 'Bem-vindo ao CotaJá! 👋',
                body: 'Aqui você descreve o que precisa e os profissionais competem pelo seu serviço. Que tal explorar as categorias disponíveis?',
            },
            {
                trigger: 'client_onboarding_d3', minDays: 3, maxDays: 4,
                title: 'Crie seu primeiro pedido em 2 minutos ⚡',
                body: 'É grátis e sem compromisso. Descreva o serviço e receba propostas de profissionais qualificados perto de você.',
            },
            {
                trigger: 'client_onboarding_d7', minDays: 7, maxDays: 8,
                title: 'Contrate com segurança no CotaJá ✅',
                body: 'Veja avaliações reais, compare propostas e converse direto com o profissional pelo app. Tudo num só lugar!',
            },
        ];
        for (const stage of stages) {
            const [rows] = await pool.execute(
                `SELECT id, name, email, fcm_token, device_platform
                 FROM users
                 WHERE profile_type = 'client'
                   AND deleted_at IS NULL
                   AND fcm_token IS NOT NULL AND fcm_token != ''
                   AND created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
                   AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
                [stage.minDays, stage.maxDays]
            );
            let sent = 0;
            for (const row of rows) {
                const ok = await this._send(row, stage.trigger, stage.title, stage.body, { screen: 'new_order' });
                if (ok) sent++;
            }
            console.log(`[DynNotif] ${stage.trigger}: ${sent}/${rows.length} enviados`);
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
            this.checkWebUserWelcomeDownloadApp(),
            this.checkClientOrderCancelledRecovery(),
            this.checkClientSeasonalReactivation(),
            this.checkClientBetterProposal(),
            this.checkClientUnreadChatMessage(),
            this.checkClientBecomeAffiliate(),
            this.checkClientOnboardingStages(),
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
