const nodemailer = require('nodemailer');
const path = require('node:path');
const { buildUnsubscribeUrl } = require('../controllers/UnsubscribeController');

// Redes sociais oficiais do CotaJá (usadas no rodapé de todos os e-mails).
const SOCIAL = {
    instagram: 'https://www.instagram.com/cotaja.io/',
    youtube:   'https://www.youtube.com/@cotajaseumarketplacedeservicos',
    facebook:  'https://www.facebook.com/share/1a9f28Zzsf/?mibextid=wwXIfr',
    tiktok:    'https://www.tiktok.com/@cotaja.seu.market',
};

const ACCENT = '#4f46e5';

class EmailService {
    constructor() {
        const mailPort = Number.parseInt(process.env.MAIL_PORT) || 465;
        this.transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST || 'smtp.gmail.com',
            port: mailPort,
            secure: mailPort === 465,
            auth: {
                user: process.env.MAIL_USERNAME || process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD || process.env.MAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        });
    }

    // ------------------------------------------------------------------
    // Infraestrutura de template reutilizável
    // ------------------------------------------------------------------

    /**
     * Anexos padrão de TODO e-mail: o logo + os 4 ícones de redes sociais.
     * Os ícones são anexados via `cid:` (não via URL externa) para evitar que
     * provedores marquem a mensagem como spam ou bloqueiem o carregamento das
     * imagens — assim os ícones sempre aparecem em Gmail, Outlook e Apple Mail.
     */
    getDefaultAttachments() {
        const img = (file) => path.join(__dirname, '../../assets/images', file);
        return [
            { filename: 'logo.png',      path: img('logo.png'),            cid: 'cotaja-logo' },
            { filename: 'instagram.png', path: img('email/instagram.png'), cid: 'ig-icon' },
            { filename: 'youtube.png',   path: img('email/youtube.png'),   cid: 'yt-icon' },
            { filename: 'facebook.png',  path: img('email/facebook.png'),  cid: 'fb-icon' },
            { filename: 'tiktok.png',    path: img('email/tiktok.png'),    cid: 'tt-icon' },
        ];
    }

    /** Rodapé padrão (escuro) com contato, ícones sociais (cid) e unsubscribe. */
    getFooterHtml(unsubscribeUrl) {
        const icon = (href, cid, alt) =>
            `<td style="padding:0 5px;">
                <a href="${href}" target="_blank" style="text-decoration:none;">
                    <img src="cid:${cid}" width="34" height="34" alt="${alt}" style="display:block;border:0;outline:none;border-radius:8px;" />
                </a>
            </td>`;

        const unsubHtml = unsubscribeUrl ? `
                <p style="margin:14px 0 0 0;color:#6b7280;font-size:11px;line-height:1.5;">
                    Não quer mais receber estes e-mails?
                    <a href="${unsubscribeUrl}" target="_blank" style="color:#9ca3af;text-decoration:underline;">Cancelar inscrição</a>.
                </p>` : '';

        return `
        <tr>
            <td style="background-color:#111827;padding:30px 40px;text-align:center;">
                <p style="margin:0 0 6px 0;color:#ffffff;font-size:15px;font-weight:bold;letter-spacing:0.5px;">CotaJá</p>
                <p style="margin:0 0 18px 0;color:#9ca3af;font-size:12px;line-height:1.5;">Seu Marketplace de Serviços<br>contato@cotaja.io &nbsp;·&nbsp; www.cotaja.io</p>
                <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                    <tr>
                        ${icon(SOCIAL.instagram, 'ig-icon', 'Instagram')}
                        ${icon(SOCIAL.youtube,   'yt-icon', 'YouTube')}
                        ${icon(SOCIAL.facebook,  'fb-icon', 'Facebook')}
                        ${icon(SOCIAL.tiktok,    'tt-icon', 'TikTok')}
                    </tr>
                </table>
                <p style="margin:18px 0 0 0;color:#6b7280;font-size:11px;line-height:1.4;">
                    Este é um e-mail automático, por favor não responda a esta mensagem.
                </p>${unsubHtml}
            </td>
        </tr>`;
    }

    /**
     * Template-base reutilizável de e-mail transacional.
     * @param {object} opts
     * @param {string} opts.heading   título principal (h1)
     * @param {string} opts.bodyHtml  conteúdo do corpo (parágrafos, blocos de detalhe...)
     * @param {string} [opts.accent]  cor de destaque (header/heading/botão)
     * @param {string} [opts.ctaText] texto do botão de ação
     * @param {string} [opts.ctaUrl]  URL do botão (deep/universal link)
     * @param {string} [opts.preheader] texto de pré-visualização (oculto)
     * @param {boolean} [opts.signature=true] inclui "Atenciosamente, Equipe Cotaja"
     * @param {string} [opts.recipientEmail] e-mail do destinatário (gera o link de unsubscribe)
     */
    renderBaseEmail({ heading, bodyHtml, accent = ACCENT, ctaText, ctaUrl, preheader = '', signature = true, recipientEmail }) {
        const unsubscribeUrl = recipientEmail ? buildUnsubscribeUrl(recipientEmail) : null;
        const ctaHtml = ctaText && ctaUrl ? `
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr><td align="center" style="padding:8px 0 4px 0;">
                                <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 40px;background-color:${accent};color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;">${ctaText}</a>
                            </td></tr>
                        </table>` : '';

        const signatureHtml = signature ? `
                    <tr><td style="padding:8px 40px 30px 40px;">
                        <p style="margin:0 0 4px 0;color:#4b5563;font-size:15px;">Atenciosamente,</p>
                        <p style="margin:0;color:${accent};font-size:15px;font-weight:bold;">Equipe CotaJá</p>
                    </td></tr>` : '';

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#eef0f5;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef0f5;padding:24px 0;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(17,24,39,0.08);">

                    <!-- Header / Logo -->
                    <tr>
                        <td style="background-color:#ffffff;padding:36px 40px 24px 40px;text-align:center;border-bottom:4px solid ${accent};">
                            <img src="cid:cotaja-logo" alt="CotaJá" style="max-width:220px;height:auto;display:block;margin:0 auto;" />
                        </td>
                    </tr>

                    <!-- Conteúdo -->
                    <tr>
                        <td style="padding:34px 40px 8px 40px;">
                            <h1 style="margin:0 0 18px 0;color:${accent};font-size:23px;font-weight:bold;text-align:center;line-height:1.3;">${heading}</h1>
                            ${bodyHtml}
                            ${ctaHtml}
                        </td>
                    </tr>

                    ${signatureHtml}

                    ${this.getFooterHtml(unsubscribeUrl)}

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();
    }

    /** Bloco de detalhe reutilizável (cartão com borda lateral colorida). */
    detailCard(title, rowsHtml, { bg = '#f9fafb', border = ACCENT } = {}) {
        return `
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${bg};border-left:4px solid ${border};border-radius:6px;margin:0 0 18px 0;">
                        <tr><td style="padding:18px 20px;">
                            <p style="margin:0 0 10px 0;color:#1f2937;font-size:15px;font-weight:bold;">${title}</p>
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">${rowsHtml}</table>
                        </td></tr>
                    </table>`;
    }

    detailRow(label, value, { valueColor = '#1f2937', valueSize = '14px', bold = false } = {}) {
        return `<tr>
            <td style="padding:4px 0;color:#6b7280;font-size:14px;width:110px;vertical-align:top;"><strong>${label}</strong></td>
            <td style="padding:4px 0;color:${valueColor};font-size:${valueSize};${bold ? 'font-weight:bold;' : ''}">${value}</td>
        </tr>`;
    }

    fromAddress() {
        return `"${process.env.MAIL_FROM_NAME || 'Cotaja'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.MAIL_USER}>`;
    }

    // ------------------------------------------------------------------
    // E-mails transacionais
    // ------------------------------------------------------------------

    async sendOrderDeletedToProviders(order, providers) {
        try {
            const emailPromises = providers.map(provider => {
                const html = this.getOrderDeletedTemplate(order, provider);
                return this.transporter.sendMail({
                    from: this.fromAddress(),
                    to: provider.email,
                    subject: `Pedido "${order.title}" foi excluído`,
                    html,
                    attachments: this.getDefaultAttachments(),
                });
            });

            const results = await Promise.allSettled(emailPromises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            console.log(`📧 Emails de exclusão enviados: ${successful} sucesso, ${failed} falhas`);
            return { successful, failed, total: providers.length };
        } catch (error) {
            console.error('Erro ao enviar emails de exclusão:', error);
            throw error;
        }
    }

    async sendNewProposalToClient(order, proposal, client, provider, ctaUrl = 'https://cotaja.io') {
        try {
            const html = this.getNewProposalTemplate(order, proposal, provider, client, ctaUrl);
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to: client.email,
                subject: `Nova proposta para "${order.title}"`,
                html,
                attachments: this.getDefaultAttachments(),
            });
            console.log(`📧 Email de nova proposta enviado para ${client.email}`);
            return { success: true };
        } catch (error) {
            console.error('Erro ao enviar email de nova proposta:', error);
            throw error;
        }
    }

    async sendProposalAcceptedToProvider(order, proposal, provider, ctaUrl = 'https://cotaja.io') {
        try {
            const html = this.getProposalAcceptedTemplate(order, proposal, provider, ctaUrl);
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to: provider.email,
                subject: `Sua proposta para "${order.title}" foi aceita!`,
                html,
                attachments: this.getDefaultAttachments(),
            });
            console.log(`📧 Email de proposta aceita enviado para ${provider.email}`);
            return { success: true };
        } catch (error) {
            console.error('Erro ao enviar email de proposta aceita:', error);
            throw error;
        }
    }

    async sendOrderCancelledNotification(order, recipient, canceller, reason) {
        try {
            const html = this.getOrderCancelledTemplate(order, recipient, canceller, reason);
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to: recipient.email,
                subject: `Pedido "${order.title}" foi cancelado`,
                html,
                attachments: this.getDefaultAttachments(),
            });
            console.log(`📧 Email de cancelamento enviado para ${recipient.email}`);
            return { success: true };
        } catch (error) {
            console.error('Erro ao enviar email de cancelamento:', error);
            throw error;
        }
    }

    async sendScheduleConfirmedNotification(order, client, provider, formattedDate) {
        try {
            const recipients = [client, provider].filter(u => u?.email);
            for (const recipient of recipients) {
                const html = this.getScheduleConfirmedTemplate(order, recipient, formattedDate);
                await this.transporter.sendMail({
                    from: this.fromAddress(),
                    to: recipient.email,
                    subject: `Serviço "${order.title}" agendado para ${formattedDate}`,
                    html,
                    attachments: this.getDefaultAttachments(),
                });
                console.log(`📧 Email de agendamento confirmado enviado para ${recipient.email}`);
            }
            return { success: true };
        } catch (error) {
            console.error('Erro ao enviar email de agendamento confirmado:', error);
            throw error;
        }
    }

    async sendScheduleReminderNotification(order, recipient, formattedDate, reminderType) {
        try {
            const html = this.getScheduleReminderTemplate(order, recipient, formattedDate, reminderType);
            const timeLabel = reminderType === '1d' ? 'amanhã' : 'em 1 hora';
            await this.transporter.sendMail({
                from: this.fromAddress(),
                to: recipient.email,
                subject: `Lembrete: Serviço "${order.title}" ${timeLabel}`,
                html,
                attachments: this.getDefaultAttachments(),
            });
            console.log(`📧 Lembrete (${reminderType}) enviado para ${recipient.email}`);
            return { success: true };
        } catch (error) {
            console.error(`Erro ao enviar lembrete (${reminderType}):`, error);
            throw error;
        }
    }

    async sendQuoteRequestToProvider(provider, client, orders) {
        const providerName = provider?.name || 'Prestador';
        const clientName = client?.name || 'Cliente';
        const list = Array.isArray(orders) ? orders.map(o => {
            const title = String(o?.title || 'Demanda');
            const category = o?.category ? ` <span style="color:#6b7280;">(${String(o.category)})</span>` : '';
            return `<li style="margin:0 0 8px 0;color:#1f2937;font-size:14px;line-height:1.4;"><strong>${title}</strong>${category}</li>`;
        }).join('') : '';

        const bodyHtml = `
                    <p style="margin:0 0 12px 0;color:#4b5563;font-size:15px;line-height:1.6;">Olá <strong>${providerName}</strong>,</p>
                    <p style="margin:0 0 18px 0;color:#4b5563;font-size:15px;line-height:1.6;">O cliente <strong>${clientName}</strong> solicitou orçamento para as demandas abaixo:</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;border-left:4px solid ${ACCENT};border-radius:6px;margin:0 0 18px 0;">
                        <tr><td style="padding:18px 20px 10px 20px;"><ul style="margin:0;padding-left:18px;">${list}</ul></td></tr>
                    </table>
                    <p style="margin:0;color:#4b5563;font-size:14px;line-height:1.6;">Acesse o app para responder essa solicitação.</p>`;

        const html = this.renderBaseEmail({
            heading: 'Solicitação de Orçamento',
            preheader: `${clientName} solicitou um orçamento`,
            bodyHtml,
            ctaText: 'Responder no app',
            ctaUrl: 'https://cotaja.io/orders',
            recipientEmail: provider?.email,
        });

        await this.transporter.sendMail({
            from: this.fromAddress(),
            to: provider.email,
            subject: `Solicitação de orçamento de ${clientName}`,
            html,
            attachments: this.getDefaultAttachments(),
        });
        console.log(`📧 Email de solicitação de orçamento enviado para ${provider.email}`);
        return { success: true };
    }

    async sendGenericNotification(recipient, subject, title, body, ctaText = 'Acessar Cotaja', ctaUrl = 'https://cotaja.io') {
        const html = this.getGenericNotificationTemplate(recipient?.name, title, body, ctaText, ctaUrl, recipient?.email);
        await this.transporter.sendMail({
            from: this.fromAddress(),
            to: recipient.email,
            subject,
            html,
            attachments: this.getDefaultAttachments(),
        });
        console.log(`📧 [GenericNotif] "${subject}" → ${recipient.email}`);
        return { success: true };
    }

    async sendWebWelcomeDownloadApp(user) {
        const subject = user.profile_type === 'provider'
            ? 'Baixe o app CotaJá e comece a receber pedidos'
            : 'Baixe o app CotaJá e crie seu primeiro pedido';
        const html = this.getWebWelcomeDownloadAppTemplate(user.name, user.profile_type, user.email);
        await this.transporter.sendMail({
            from: this.fromAddress(),
            to: user.email,
            subject,
            html,
            attachments: this.getDefaultAttachments(),
        });
        console.log(`📧 [WebWelcome] "${subject}" → ${user.email}`);
        return { success: true };
    }

    // ------------------------------------------------------------------
    // Templates
    // ------------------------------------------------------------------

    getNewProposalTemplate(order, proposal, provider, client, ctaUrl = 'https://cotaja.io') {
        const priceFormatted = Number.parseFloat(proposal.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const clientName = client?.name || 'Cliente';

        const orderRows = this.detailRow('Título', order.title) + (order.category ? this.detailRow('Categoria', order.category) : '');
        let proposalRows = this.detailRow('Prestador', provider.name)
            + this.detailRow('Valor', `R$ ${priceFormatted}`, { valueColor: '#10b981', valueSize: '18px', bold: true });
        if (proposal.deadline) proposalRows += this.detailRow('Prazo', `${proposal.deadline} dias`);
        if (proposal.description) proposalRows += `<tr><td colspan="2" style="padding:10px 0 0;"><strong style="color:#6b7280;font-size:14px;">Descrição:</strong><p style="margin:5px 0 0;color:#1f2937;font-size:14px;line-height:1.5;">${proposal.description}</p></td></tr>`;

        const bodyHtml = `
                    <p style="margin:0 0 14px 0;color:#4b5563;font-size:15px;line-height:1.6;">Prezado(a) <strong>${clientName}</strong>,</p>
                    <p style="margin:0 0 18px 0;color:#4b5563;font-size:15px;line-height:1.6;">Ótima notícia! Você recebeu uma nova proposta para o seu pedido <strong>"${order.title}"</strong>. Confira os detalhes:</p>
                    ${this.detailCard('Detalhes do Pedido', orderRows, { bg: '#f0fdf4', border: '#10b981' })}
                    ${this.detailCard('Detalhes da Proposta', proposalRows, { bg: '#f9fafb', border: '#2563eb' })}
                    <p style="margin:0 0 18px 0;color:#4b5563;font-size:15px;line-height:1.6;">Acesse o app para comparar com outras propostas e tomar sua decisão.</p>`;

        return this.renderBaseEmail({
            heading: 'Nova Proposta Recebida!',
            preheader: `${provider.name} enviou uma proposta de R$ ${priceFormatted}`,
            accent: '#10b981',
            bodyHtml,
            ctaText: 'Ver Proposta',
            ctaUrl,
            recipientEmail: client?.email,
        });
    }

    getProposalAcceptedTemplate(order, proposal, provider, ctaUrl = 'https://cotaja.io') {
        const priceFormatted = Number.parseFloat(proposal.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const providerName = provider?.name || 'Prestador';

        const orderRows = this.detailRow('Título', order.title) + (order.category ? this.detailRow('Categoria', order.category) : '');
        let proposalRows = this.detailRow('Valor', `R$ ${priceFormatted}`, { valueColor: '#10b981', valueSize: '18px', bold: true });
        if (proposal.deadline) proposalRows += this.detailRow('Prazo', `${proposal.deadline} dias`);
        if (proposal.description) proposalRows += `<tr><td colspan="2" style="padding:10px 0 0;"><strong style="color:#6b7280;font-size:14px;">Descrição:</strong><p style="margin:5px 0 0;color:#1f2937;font-size:14px;line-height:1.5;">${proposal.description}</p></td></tr>`;

        const bodyHtml = `
                    <p style="margin:0 0 14px 0;color:#4b5563;font-size:15px;line-height:1.6;">Prezado(a) <strong>${providerName}</strong>,</p>
                    <p style="margin:0 0 18px 0;color:#4b5563;font-size:15px;line-height:1.6;">Ótima notícia! Sua proposta para o pedido <strong>"${order.title}"</strong> foi aceita pelo cliente. Agora é hora de colocar a mão na obra!</p>
                    ${this.detailCard('Detalhes do Pedido', orderRows, { bg: '#f0fdf4', border: '#10b981' })}
                    ${this.detailCard('Sua Proposta', proposalRows, { bg: '#f0fdf4', border: '#10b981' })}
                    <p style="margin:0 0 18px 0;color:#4b5563;font-size:15px;line-height:1.6;">Acesse o app para ver os detalhes completos e alinhar os próximos passos com o cliente.</p>`;

        return this.renderBaseEmail({
            heading: 'Sua Proposta foi Aceita!',
            preheader: `Sua proposta de R$ ${priceFormatted} foi aceita`,
            accent: '#10b981',
            bodyHtml,
            ctaText: 'Ver Detalhes do Pedido',
            ctaUrl,
            recipientEmail: provider?.email,
        });
    }

    getOrderCancelledTemplate(order, recipient, canceller, reason) {
        const recipientName = recipient?.name || 'Usuário';
        const cancellerName = canceller?.name || 'Usuário';

        const bodyHtml = `
                    <p style="margin:0 0 14px 0;color:#4b5563;font-size:15px;line-height:1.6;">Prezado(a) <strong>${recipientName}</strong>,</p>
                    <p style="margin:0 0 18px 0;color:#4b5563;font-size:15px;line-height:1.6;">O pedido <strong>"${order.title}"</strong> foi cancelado por <strong>${cancellerName}</strong>.</p>
                    ${this.detailCard('Motivo do Cancelamento', `<tr><td style="padding:2px 0;color:#1f2937;font-size:14px;line-height:1.5;">${reason}</td></tr>`, { bg: '#fef2f2', border: '#ef4444' })}`;

        return this.renderBaseEmail({
            heading: 'Pedido Cancelado',
            preheader: `O pedido "${order.title}" foi cancelado`,
            accent: '#ef4444',
            bodyHtml,
            ctaText: 'Acessar Plataforma',
            ctaUrl: 'https://cotaja.io',
            recipientEmail: recipient?.email,
        });
    }

    getScheduleConfirmedTemplate(order, recipient, formattedDate) {
        const recipientName = recipient?.name || 'Usuário';

        const bodyHtml = `
                    <p style="margin:0 0 14px 0;color:#4b5563;font-size:15px;line-height:1.6;">Prezado(a) <strong>${recipientName}</strong>,</p>
                    <p style="margin:0 0 18px 0;color:#4b5563;font-size:15px;line-height:1.6;">O serviço <strong>"${order.title}"</strong> foi confirmado por ambas as partes!</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f0fdf4;border-left:4px solid #10b981;border-radius:6px;margin:0 0 18px 0;">
                        <tr><td style="padding:20px;text-align:center;">
                            <p style="margin:0 0 5px 0;color:#6b7280;font-size:14px;">Data e Horário</p>
                            <p style="margin:0;color:#10b981;font-size:22px;font-weight:bold;">${formattedDate}</p>
                        </td></tr>
                    </table>
                    <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.6;">Você receberá lembretes 1 dia antes e 1 hora antes da data agendada.</p>`;

        return this.renderBaseEmail({
            heading: 'Serviço Agendado!',
            preheader: `Serviço agendado para ${formattedDate}`,
            accent: '#10b981',
            bodyHtml,
            ctaText: 'Ver no app',
            ctaUrl: 'https://cotaja.io/orders',
            recipientEmail: recipient?.email,
        });
    }

    getScheduleReminderTemplate(order, recipient, formattedDate, reminderType) {
        const recipientName = recipient?.name || 'Usuário';
        const timeLabel = reminderType === '1d' ? 'amanhã' : 'em 1 hora';

        const bodyHtml = `
                    <p style="margin:0 0 14px 0;color:#4b5563;font-size:15px;line-height:1.6;">Prezado(a) <strong>${recipientName}</strong>,</p>
                    <p style="margin:0 0 18px 0;color:#4b5563;font-size:15px;line-height:1.6;">Lembramos que o serviço <strong>"${order.title}"</strong> está agendado para <strong>${timeLabel}</strong>!</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;margin:0 0 18px 0;">
                        <tr><td style="padding:20px;text-align:center;">
                            <p style="margin:0 0 5px 0;color:#6b7280;font-size:14px;">Data e Horário</p>
                            <p style="margin:0;color:#d97706;font-size:22px;font-weight:bold;">${formattedDate}</p>
                        </td></tr>
                    </table>`;

        return this.renderBaseEmail({
            heading: 'Lembrete de Serviço',
            preheader: `Seu serviço está agendado para ${timeLabel}`,
            accent: '#f59e0b',
            bodyHtml,
            ctaText: 'Ver no app',
            ctaUrl: 'https://cotaja.io/orders',
            recipientEmail: recipient?.email,
        });
    }

    getOrderDeletedTemplate(order, provider) {
        const budgetFormatted = order.budget ? `R$ ${Number.parseFloat(order.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Não informado';

        let orderRows = this.detailRow('Título', order.title) + (order.category ? this.detailRow('Categoria', order.category) : '');
        orderRows += this.detailRow('Orçamento', budgetFormatted);

        const bodyHtml = `
                    <p style="margin:0 0 14px 0;color:#4b5563;font-size:15px;line-height:1.6;">Prezado(a) <strong>${provider.name}</strong>,</p>
                    <p style="margin:0 0 18px 0;color:#4b5563;font-size:15px;line-height:1.6;">Informamos que o pedido <strong>"${order.title}"</strong> para o qual você enviou uma proposta foi excluído pelo cliente.</p>
                    ${this.detailCard('Detalhes do Pedido', orderRows, { bg: '#fef2f2', border: '#ef4444' })}
                    <p style="margin:0 0 18px 0;color:#4b5563;font-size:15px;line-height:1.6;">Não se preocupe! Você pode continuar navegando por outros pedidos disponíveis e enviar novas propostas.</p>`;

        return this.renderBaseEmail({
            heading: 'Pedido Excluído',
            preheader: `O pedido "${order.title}" foi excluído`,
            accent: '#ef4444',
            bodyHtml,
            ctaText: 'Ver Pedidos Disponíveis',
            ctaUrl: 'https://cotaja.io/orders',
            recipientEmail: provider?.email,
        });
    }

    getGenericNotificationTemplate(recipientName, title, body, ctaText, ctaUrl, recipientEmail) {
        const name = recipientName || 'Olá';
        const bodyHtml = `
                    <p style="margin:0 0 12px 0;color:#4b5563;font-size:15px;line-height:1.6;">Olá, <strong>${name}</strong>!</p>
                    <p style="margin:0 0 22px 0;color:#4b5563;font-size:15px;line-height:1.6;">${body}</p>`;

        return this.renderBaseEmail({
            heading: title,
            preheader: body,
            bodyHtml,
            ctaText,
            ctaUrl,
            recipientEmail,
        });
    }

    getWebWelcomeDownloadAppTemplate(name, profileType, recipientEmail) {
        const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.cotaja_rn';
        const appStoreUrl = 'https://apps.apple.com/br/app/cotaja/id6753153412';
        const isProvider = profileType === 'provider';
        const headline = isProvider ? 'Receba pedidos e cresça no CotaJá' : 'Encontre profissionais perto de você';
        const intro = isProvider
            ? 'Sua conta de prestador foi criada com sucesso. Baixe o app para receber pedidos, enviar propostas e gerenciar tudo pelo celular.'
            : 'Sua conta foi criada com sucesso. Baixe o app para criar pedidos, receber propostas e acompanhar tudo em tempo real.';
        const benefits = isProvider
            ? ['Receba pedidos de clientes da sua região', 'Envie propostas e aumente seu faturamento', 'Gerencie propostas e conversas no celular', 'Construa reputação com avaliações verificadas', 'Plano premium com 3 meses grátis para novos prestadores']
            : ['Crie pedidos de serviço em menos de 2 minutos', 'Receba propostas de vários profissionais qualificados', 'Compare preços, prazos e avaliações', 'Acompanhe o andamento do serviço pelo app', 'Receba alertas quando chegar nova proposta'];
        const benefitsHtml = benefits.map((item) =>
            `<tr><td style="padding:0 0 10px 0;color:#4b5563;font-size:15px;line-height:1.5;">✓ ${item}</td></tr>`
        ).join('');

        const bodyHtml = `
                    <p style="margin:0 0 12px 0;color:#4b5563;font-size:15px;line-height:1.6;">Olá, <strong>${name || 'Olá'}</strong>!</p>
                    <p style="margin:0 0 20px 0;color:#4b5563;font-size:15px;line-height:1.6;">${intro}</p>
                    <p style="margin:0 0 12px 0;color:#1f2937;font-size:16px;font-weight:bold;">No app você pode:</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">${benefitsHtml}</table>
                    <p style="margin:0 0 16px 0;color:#4b5563;font-size:15px;line-height:1.6;text-align:center;">Baixe grátis na loja do seu celular:</p>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:0 0 20px 0;">
                        <a href="${playStoreUrl}" target="_blank" style="display:inline-block;padding:13px 24px;background-color:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:bold;margin:0 6px 8px 6px;">Google Play</a>
                        <a href="${appStoreUrl}" target="_blank" style="display:inline-block;padding:13px 24px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:bold;margin:0 6px 8px 6px;">App Store</a>
                    </td></tr></table>
                    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;text-align:center;">Use o mesmo e-mail e senha do cadastro para entrar no app.</p>`;

        return this.renderBaseEmail({
            heading: headline,
            preheader: intro,
            bodyHtml,
            recipientEmail,
        });
    }
}

module.exports = new EmailService();
