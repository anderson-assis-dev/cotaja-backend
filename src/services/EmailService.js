const nodemailer = require('nodemailer');
const path = require('node:path');

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


    async sendOrderDeletedToProviders(order, providers) {
        try {
            const emailPromises = providers.map(provider => {
                const html = this.getOrderDeletedTemplate(order, provider);

                return this.transporter.sendMail({
                    from: `"${process.env.MAIL_FROM_NAME || 'Cotaja'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.MAIL_USER}>`,
                    to: provider.email,
                    subject: `Pedido "${order.title}" foi excluído`,
                    html,
                    attachments: [
                        {
                            filename: 'logo.png',
                            path: path.join(__dirname, '../../assets/images/logo.png'),
                            cid: 'cotaja-logo'
                        }
                    ]
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


    async sendNewProposalToClient(order, proposal, client, provider) {
        try {
            const html = this.getNewProposalTemplate(order, proposal, provider, client);

            await this.transporter.sendMail({
                from: `"${process.env.MAIL_FROM_NAME || 'Cotaja'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.MAIL_USER}>`,
                to: client.email,
                subject: `Nova proposta para "${order.title}"`,
                html,
                attachments: [
                    {
                        filename: 'logo.png',
                        path: path.join(__dirname, '../../assets/images/logo.png'),
                        cid: 'cotaja-logo'
                    }
                ]
            });

            console.log(`📧 Email de nova proposta enviado para ${client.email}`);

            return { success: true };
        } catch (error) {
            console.error('Erro ao enviar email de nova proposta:', error);
            throw error;
        }
    }


    getNewProposalTemplate(order, proposal, provider, client) {
        const priceFormatted = Number.parseFloat(proposal.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const clientName = client?.name || 'Cliente';

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                    <!-- Header com Logo -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 40px 40px 30px 40px; text-align: center; border-bottom: 3px solid #10b981;">
                            <img src="cid:cotaja-logo" alt="Cotaja" style="max-width: 250px; height: auto; display: block; margin: 0 auto;" />
                        </td>
                    </tr>

                    <!-- Conteúdo Principal -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px;">
                            <h2 style="margin: 0 0 20px 0; color: #10b981; font-size: 24px; text-align: center;">
                                Nova Proposta Recebida!
                            </h2>

                            <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                Prezado(a) <strong>${clientName}</strong>,
                            </p>

                            <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                Ótima notícia! Você recebeu uma nova proposta para o seu pedido <strong>"${order.title}"</strong>. Confira os detalhes abaixo:
                            </p>
                        </td>
                    </tr>

                    <!-- Detalhes do Pedido -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px; padding: 20px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: bold;">Detalhes do Pedido</p>
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Título:</strong></td>
                                                <td style="padding: 4px 0; color: #1f2937; font-size: 14px;">${order.title}</td>
                                            </tr>
                                            ${order.category ? `<tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px;"><strong>Categoria:</strong></td>
                                                <td style="padding: 4px 0; color: #1f2937; font-size: 14px;">${order.category}</td>
                                            </tr>` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Detalhes da Proposta -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f9fafb; border-left: 4px solid #2563eb; border-radius: 4px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: bold;">Detalhes da Proposta</p>
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Prestador:</strong></td>
                                                <td style="padding: 4px 0; color: #1f2937; font-size: 14px;">${provider.name}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px;"><strong>Valor:</strong></td>
                                                <td style="padding: 4px 0; color: #10b981; font-size: 18px; font-weight: bold;">R$ ${priceFormatted}</td>
                                            </tr>
                                            ${proposal.deadline ? `<tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px;"><strong>Prazo:</strong></td>
                                                <td style="padding: 4px 0; color: #1f2937; font-size: 14px;">${proposal.deadline} dias</td>
                                            </tr>` : ''}
                                            ${proposal.description ? `<tr>
                                                <td colspan="2" style="padding: 10px 0 0;">
                                                    <strong style="color: #6b7280; font-size: 14px;">Descrição:</strong>
                                                    <p style="margin: 5px 0 0; color: #1f2937; font-size: 14px; line-height: 1.5;">${proposal.description}</p>
                                                </td>
                                            </tr>` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Texto + CTA -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <p style="margin: 0 0 25px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                Acesse a plataforma para ver todos os detalhes, comparar com outras propostas e tomar sua decisão.
                            </p>

                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 10px 0;">
                                        <a href="https://cotaja.io" style="display: inline-block; padding: 14px 40px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                                            Ver Proposta
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Assinatura -->
                    <tr>
                        <td style="padding: 20px 40px 30px 40px;">
                            <p style="margin: 0 0 5px 0; color: #4b5563; font-size: 16px;">Atenciosamente,</p>
                            <p style="margin: 0; color: #2563eb; font-size: 16px; font-weight: bold;">Equipe Cotaja</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #1f2937; padding: 30px 40px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;"><strong>COTAJA</strong></p>
                            <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">contato@cotaja.io<br>www.cotaja.io</p>
                            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 15px auto 0 auto;"><tr>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.instagram.com/cotaja.io" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#E1306C" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="white" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="white"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.kwai.com/@cotajaseumarke" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF8C00" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4v16M6 12l8-8M6 12l8 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 6l4 6-4 6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.tiktok.com/@cotaja.seu.market" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#010101" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.facebook.com/share/1ArvGRTDmo/" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#1877F2" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://youtube.com/@cotajaseumarketplacedeservicos" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF0000" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96C1 8.12 1 12 1 12s0 3.88.46 5.58a2.78 2.78 0 0 0 1.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95C23 15.88 23 12 23 12s0-3.88-.46-5.58z" stroke="white" stroke-width="2"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg></td></tr></table></a>
                                </td>
                            </tr></table>
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 11px; line-height: 1.4;">
                                Este é um email automático, por favor não responda a esta mensagem.<br>
                                Caso tenha dúvidas, entre em contato através do nosso suporte.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `.trim();
    }


    async sendProposalAcceptedToProvider(order, proposal, provider) {
        try {
            const html = this.getProposalAcceptedTemplate(order, proposal, provider);

            await this.transporter.sendMail({
                from: `"${process.env.MAIL_FROM_NAME || 'Cotaja'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.MAIL_USER}>`,
                to: provider.email,
                subject: `Sua proposta para "${order.title}" foi aceita!`,
                html,
                attachments: [
                    {
                        filename: 'logo.png',
                        path: path.join(__dirname, '../../assets/images/logo.png'),
                        cid: 'cotaja-logo'
                    }
                ]
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
                from: `"${process.env.MAIL_FROM_NAME || 'Cotaja'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.MAIL_USER}>`,
                to: recipient.email,
                subject: `Pedido "${order.title}" foi cancelado`,
                html,
                attachments: [
                    {
                        filename: 'logo.png',
                        path: path.join(__dirname, '../../assets/images/logo.png'),
                        cid: 'cotaja-logo'
                    }
                ]
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
                    from: `"${process.env.MAIL_FROM_NAME || 'Cotaja'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.MAIL_USER}>`,
                    to: recipient.email,
                    subject: `Serviço "${order.title}" agendado para ${formattedDate}`,
                    html,
                    attachments: [
                        {
                            filename: 'logo.png',
                            path: path.join(__dirname, '../../assets/images/logo.png'),
                            cid: 'cotaja-logo'
                        }
                    ]
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
                from: `"${process.env.MAIL_FROM_NAME || 'Cotaja'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.MAIL_USER}>`,
                to: recipient.email,
                subject: `Lembrete: Serviço "${order.title}" ${timeLabel}`,
                html,
                attachments: [
                    {
                        filename: 'logo.png',
                        path: path.join(__dirname, '../../assets/images/logo.png'),
                        cid: 'cotaja-logo'
                    }
                ]
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
            const category = o?.category ? ' <span style="color:#6b7280;">(' + String(o.category) + ')</span>' : '';
            return '<li style="margin:0 0 8px 0;color:#1f2937;font-size:14px;line-height:1.4;"><strong>' + title + '</strong>' + category + '</li>';
        }).join('') : '';
        const html = `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;padding:20px 0;"><tr><td align="center"><table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);"><tr><td style="background-color:#ffffff;padding:36px 40px 26px 40px;text-align:center;border-bottom:3px solid #4f46e5;"><img src="cid:cotaja-logo" alt="Cotaja" style="max-width:220px;height:auto;display:block;margin:0 auto;" /></td></tr><tr><td style="padding:32px 40px 10px 40px;"><h2 style="margin:0 0 14px 0;color:#4f46e5;font-size:22px;text-align:center;">Solicitação de Orçamento</h2><p style="margin:0 0 12px 0;color:#4b5563;font-size:15px;line-height:1.6;">Olá <strong>${providerName}</strong>,</p><p style="margin:0;color:#4b5563;font-size:15px;line-height:1.6;">O cliente <strong>${clientName}</strong> solicitou orçamento para as demandas abaixo:</p></td></tr><tr><td style="padding:0 40px 20px 40px;"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;border-left:4px solid #4f46e5;border-radius:4px;"><tr><td style="padding:18px 18px 10px 18px;"><ul style="margin:0;padding-left:18px;">${list}</ul></td></tr></table></td></tr><tr><td style="padding:0 40px 24px 40px;"><p style="margin:0;color:#4b5563;font-size:14px;line-height:1.6;">Acesse o app para responder essa solicitação.</p></td></tr><tr><td style="background-color:#1f2937;padding:26px 40px;text-align:center;"><p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.4;">Este é um email automático, por favor não responda.</p></td></tr></table></td></tr></table></body></html>
        `.trim();
        await this.transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME || 'Cotaja'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.MAIL_USER}>`,
            to: provider.email,
            subject: `Solicitação de orçamento de ${clientName}`,
            html,
            attachments: [{ filename: 'logo.png', path: path.join(__dirname, '../../assets/images/logo.png'), cid: 'cotaja-logo' }]
        });
        console.log(`📧 Email de solicitação de orçamento enviado para ${provider.email}`);
        return { success: true };
    }


    getProposalAcceptedTemplate(order, proposal, provider) {
        const priceFormatted = Number.parseFloat(proposal.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const providerName = provider?.name || 'Prestador';

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                    <!-- Header com Logo -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 40px 40px 30px 40px; text-align: center; border-bottom: 3px solid #10b981;">
                            <img src="cid:cotaja-logo" alt="Cotaja" style="max-width: 250px; height: auto; display: block; margin: 0 auto;" />
                        </td>
                    </tr>

                    <!-- Conteúdo Principal -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px;">
                            <h2 style="margin: 0 0 20px 0; color: #10b981; font-size: 24px; text-align: center;">
                                Sua Proposta foi Aceita!
                            </h2>

                            <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                Prezado(a) <strong>${providerName}</strong>,
                            </p>

                            <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                Ótima notícia! Sua proposta para o pedido <strong>"${order.title}"</strong> foi aceita pelo cliente. Agora é hora de colocar a mão na obra!
                            </p>
                        </td>
                    </tr>

                    <!-- Detalhes do Pedido -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: bold;">Detalhes do Pedido</p>
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Título:</strong></td>
                                                <td style="padding: 4px 0; color: #1f2937; font-size: 14px;">${order.title}</td>
                                            </tr>
                                            ${order.category ? `<tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px;"><strong>Categoria:</strong></td>
                                                <td style="padding: 4px 0; color: #1f2937; font-size: 14px;">${order.category}</td>
                                            </tr>` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Detalhes da Proposta Aceita -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: bold;">Sua Proposta</p>
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Valor:</strong></td>
                                                <td style="padding: 4px 0; color: #10b981; font-size: 18px; font-weight: bold;">R$ ${priceFormatted}</td>
                                            </tr>
                                            ${proposal.deadline ? `<tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px;"><strong>Prazo:</strong></td>
                                                <td style="padding: 4px 0; color: #1f2937; font-size: 14px;">${proposal.deadline} dias</td>
                                            </tr>` : ''}
                                            ${proposal.description ? `<tr>
                                                <td colspan="2" style="padding: 10px 0 0;">
                                                    <strong style="color: #6b7280; font-size: 14px;">Descrição:</strong>
                                                    <p style="margin: 5px 0 0; color: #1f2937; font-size: 14px; line-height: 1.5;">${proposal.description}</p>
                                                </td>
                                            </tr>` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Texto + CTA -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <p style="margin: 0 0 25px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                Acesse a plataforma para ver os detalhes completos do pedido e entrar em contato com o cliente para alinhar os próximos passos.
                            </p>

                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 10px 0;">
                                        <a href="https://cotaja.io" style="display: inline-block; padding: 14px 40px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                                            Ver Detalhes do Pedido
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Assinatura -->
                    <tr>
                        <td style="padding: 20px 40px 30px 40px;">
                            <p style="margin: 0 0 5px 0; color: #4b5563; font-size: 16px;">Atenciosamente,</p>
                            <p style="margin: 0; color: #2563eb; font-size: 16px; font-weight: bold;">Equipe Cotaja</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #1f2937; padding: 30px 40px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;"><strong>COTAJA</strong></p>
                            <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">contato@cotaja.io<br>www.cotaja.io</p>
                            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 15px auto 0 auto;"><tr>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.instagram.com/cotaja.io" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#E1306C" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="white" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="white"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.kwai.com/@cotajaseumarke" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF8C00" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4v16M6 12l8-8M6 12l8 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 6l4 6-4 6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.tiktok.com/@cotaja.seu.market" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#010101" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.facebook.com/share/1ArvGRTDmo/" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#1877F2" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://youtube.com/@cotajaseumarketplacedeservicos" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF0000" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96C1 8.12 1 12 1 12s0 3.88.46 5.58a2.78 2.78 0 0 0 1.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95C23 15.88 23 12 23 12s0-3.88-.46-5.58z" stroke="white" stroke-width="2"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg></td></tr></table></a>
                                </td>
                            </tr></table>
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 11px; line-height: 1.4;">
                                Este é um email automático, por favor não responda a esta mensagem.<br>
                                Caso tenha dúvidas, entre em contato através do nosso suporte.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `.trim();
    }


    getOrderCancelledTemplate(order, recipient, canceller, reason) {
        const recipientName = recipient?.name || 'Usuário';
        const cancellerName = canceller?.name || 'Usuário';

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr><td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr><td style="background-color: #ffffff; padding: 40px 40px 30px 40px; text-align: center; border-bottom: 3px solid #ef4444;"><img src="cid:cotaja-logo" alt="Cotaja" style="max-width: 250px; height: auto; display: block; margin: 0 auto;" /></td></tr>
                    <tr><td style="padding: 40px 40px 20px 40px;">
                        <h2 style="margin: 0 0 20px 0; color: #ef4444; font-size: 24px; text-align: center;">Pedido Cancelado</h2>
                        <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">Prezado(a) <strong>${recipientName}</strong>,</p>
                        <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">O pedido <strong>"${order.title}"</strong> foi cancelado por <strong>${cancellerName}</strong>.</p>
                    </td></tr>
                    <tr><td style="padding: 0 40px 20px 40px;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
                            <tr><td style="padding: 20px;">
                                <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: bold;">Motivo do Cancelamento</p>
                                <p style="margin: 0; color: #1f2937; font-size: 14px; line-height: 1.5;">${reason}</p>
                            </td></tr>
                        </table>
                    </td></tr>
                    <tr><td style="padding: 0 40px 20px 40px;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding: 10px 0;"><a href="https://cotaja.io" style="display: inline-block; padding: 14px 40px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">Acessar Plataforma</a></td></tr></table>
                    </td></tr>
                    <tr><td style="padding: 20px 40px 30px 40px;"><p style="margin: 0 0 5px 0; color: #4b5563; font-size: 16px;">Atenciosamente,</p><p style="margin: 0; color: #2563eb; font-size: 16px; font-weight: bold;">Equipe Cotaja</p></td></tr>
                    <tr><td style="background-color: #1f2937; padding: 30px 40px; text-align: center;"><p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;"><strong>COTAJA</strong></p><p style="margin: 0; color: #6b7280; font-size: 11px;">Este é um email automático, por favor não responda.</p></td></tr>
                </table>
        </td></tr>
    </table>
</body></html>`.trim();
    }


    getScheduleConfirmedTemplate(order, recipient, formattedDate) {
        const recipientName = recipient?.name || 'Usuário';

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr><td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr><td style="background-color: #ffffff; padding: 40px 40px 30px 40px; text-align: center; border-bottom: 3px solid #10b981;"><img src="cid:cotaja-logo" alt="Cotaja" style="max-width: 250px; height: auto; display: block; margin: 0 auto;" /></td></tr>
                    <tr><td style="padding: 40px 40px 20px 40px;">
                        <h2 style="margin: 0 0 20px 0; color: #10b981; font-size: 24px; text-align: center;">Serviço Agendado!</h2>
                        <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">Prezado(a) <strong>${recipientName}</strong>,</p>
                        <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">O serviço <strong>"${order.title}"</strong> foi confirmado por ambas as partes!</p>
                    </td></tr>
                    <tr><td style="padding: 0 40px 20px 40px;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                            <tr><td style="padding: 20px; text-align: center;">
                                <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Data e Horário</p>
                                <p style="margin: 0; color: #10b981; font-size: 22px; font-weight: bold;">${formattedDate}</p>
                            </td></tr>
                        </table>
                    </td></tr>
                    <tr><td style="padding: 0 40px 20px 40px;"><p style="margin: 0 0 25px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">Você receberá lembretes 1 dia antes e 1 hora antes da data agendada.</p></td></tr>
                    <tr><td style="padding: 20px 40px 30px 40px;"><p style="margin: 0 0 5px 0; color: #4b5563; font-size: 16px;">Atenciosamente,</p><p style="margin: 0; color: #2563eb; font-size: 16px; font-weight: bold;">Equipe Cotaja</p></td></tr>
                    <tr><td style="background-color: #1f2937; padding: 30px 40px; text-align: center;"><p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;"><strong>COTAJA</strong></p><p style="margin: 0; color: #6b7280; font-size: 11px;">Este é um email automático, por favor não responda.</p></td></tr>
                </table>
        </td></tr>
    </table>
</body></html>`.trim();
    }


    getScheduleReminderTemplate(order, recipient, formattedDate, reminderType) {
        const recipientName = recipient?.name || 'Usuário';
        const timeLabel = reminderType === '1d' ? 'amanhã' : 'em 1 hora';

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr><td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr><td style="background-color: #ffffff; padding: 40px 40px 30px 40px; text-align: center; border-bottom: 3px solid #f59e0b;"><img src="cid:cotaja-logo" alt="Cotaja" style="max-width: 250px; height: auto; display: block; margin: 0 auto;" /></td></tr>
                    <tr><td style="padding: 40px 40px 20px 40px;">
                        <h2 style="margin: 0 0 20px 0; color: #f59e0b; font-size: 24px; text-align: center;">Lembrete de Serviço</h2>
                        <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">Prezado(a) <strong>${recipientName}</strong>,</p>
                        <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">Lembramos que o serviço <strong>"${order.title}"</strong> está agendado para <strong>${timeLabel}</strong>!</p>
                    </td></tr>
                    <tr><td style="padding: 0 40px 20px 40px;">
                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px;">
                            <tr><td style="padding: 20px; text-align: center;">
                                <p style="margin: 0 0 5px 0; color: #6b7280; font-size: 14px;">Data e Horário</p>
                                <p style="margin: 0; color: #d97706; font-size: 22px; font-weight: bold;">${formattedDate}</p>
                            </td></tr>
                        </table>
                    </td></tr>
                    <tr><td style="padding: 20px 40px 30px 40px;"><p style="margin: 0 0 5px 0; color: #4b5563; font-size: 16px;">Atenciosamente,</p><p style="margin: 0; color: #2563eb; font-size: 16px; font-weight: bold;">Equipe Cotaja</p></td></tr>
                    <tr><td style="background-color: #1f2937; padding: 30px 40px; text-align: center;"><p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;"><strong>COTAJA</strong></p><p style="margin: 0; color: #6b7280; font-size: 11px;">Este é um email automático, por favor não responda.</p></td></tr>
                </table>
        </td></tr>
    </table>
</body></html>`.trim();
    }


    async sendGenericNotification(recipient, subject, title, body, ctaText = 'Acessar Cotaja', ctaUrl = 'https://cotaja.io') {
        const html = this.getGenericNotificationTemplate(recipient?.name, title, body, ctaText, ctaUrl);
        await this.transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME || 'Cotaja'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.MAIL_USER}>`,
            to: recipient.email,
            subject,
            html,
            attachments: [{ filename: 'logo.png', path: path.join(__dirname, '../../assets/images/logo.png'), cid: 'cotaja-logo' }]
        });
        console.log(`📧 [GenericNotif] "${subject}" → ${recipient.email}`);
        return { success: true };
    }

    getGenericNotificationTemplate(recipientName, title, body, ctaText, ctaUrl) {
        const name = recipientName || 'Olá';
        return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;padding:20px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
      <tr><td style="background-color:#ffffff;padding:36px 40px 26px 40px;text-align:center;border-bottom:3px solid #4f46e5;">
        <img src="cid:cotaja-logo" alt="Cotaja" style="max-width:220px;height:auto;display:block;margin:0 auto;" />
      </td></tr>
      <tr><td style="padding:36px 40px 10px 40px;">
        <h2 style="margin:0 0 16px 0;color:#4f46e5;font-size:22px;text-align:center;">${title}</h2>
        <p style="margin:0 0 12px 0;color:#4b5563;font-size:15px;line-height:1.6;">Olá, <strong>${name}</strong>!</p>
        <p style="margin:0 0 24px 0;color:#4b5563;font-size:15px;line-height:1.6;">${body}</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:8px 0 28px;">
          <a href="${ctaUrl}" style="display:inline-block;padding:13px 38px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:bold;">${ctaText}</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:0 40px 28px 40px;">
        <p style="margin:0;color:#4b5563;font-size:15px;">Atenciosamente,</p>
        <p style="margin:4px 0 0;color:#4f46e5;font-size:15px;font-weight:bold;">Equipe Cotaja</p>
      </td></tr>
      <tr><td style="background-color:#1f2937;padding:26px 40px;text-align:center;">
        <p style="margin:0 0 6px 0;color:#ffffff;font-size:13px;font-weight:bold;">COTAJA</p>
        <p style="margin:0 0 14px 0;color:#9ca3af;font-size:12px;">contato@cotaja.io · www.cotaja.io</p>
        <table cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td style="padding:0 4px;"><a href="https://www.instagram.com/cotaja.io" style="display:block;text-decoration:none;"><table width="34" height="34" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#E1306C" style="border-radius:7px;width:34px;height:34px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="white" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="white"/></svg></td></tr></table></a></td>
          <td style="padding:0 4px;"><a href="https://www.facebook.com/share/1ArvGRTDmo/" style="display:block;text-decoration:none;"><table width="34" height="34" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#1877F2" style="border-radius:7px;width:34px;height:34px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table></a></td>
          <td style="padding:0 4px;"><a href="https://youtube.com/@cotajaseumarketplacedeservicos" style="display:block;text-decoration:none;"><table width="34" height="34" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF0000" style="border-radius:7px;width:34px;height:34px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96C1 8.12 1 12 1 12s0 3.88.46 5.58a2.78 2.78 0 0 0 1.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95C23 15.88 23 12 23 12s0-3.88-.46-5.58z" stroke="white" stroke-width="2"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg></td></tr></table></a></td>
        </tr></table>
        <p style="margin:16px 0 0;color:#6b7280;font-size:11px;">Este é um email automático, por favor não responda.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`.trim();
    }

    getOrderDeletedTemplate(order, provider) {
        const budgetFormatted = order.budget ? `R$ ${Number.parseFloat(order.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Não informado';

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                    <!-- Header com Logo -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 40px 40px 30px 40px; text-align: center; border-bottom: 3px solid #ef4444;">
                            <img src="cid:cotaja-logo" alt="Cotaja" style="max-width: 250px; height: auto; display: block; margin: 0 auto;" />
                        </td>
                    </tr>

                    <!-- Conteúdo Principal -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px;">
                            <h2 style="margin: 0 0 20px 0; color: #ef4444; font-size: 24px; text-align: center;">
                                Pedido Excluído
                            </h2>

                            <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                Prezado(a) <strong>${provider.name}</strong>,
                            </p>

                            <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                Informamos que o pedido <strong>"${order.title}"</strong> para o qual você enviou uma proposta foi excluído pelo cliente.
                            </p>
                        </td>
                    </tr>

                    <!-- Detalhes do Pedido -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: bold;">Detalhes do Pedido</p>
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Título:</strong></td>
                                                <td style="padding: 4px 0; color: #1f2937; font-size: 14px;">${order.title}</td>
                                            </tr>
                                            ${order.category ? `<tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px;"><strong>Categoria:</strong></td>
                                                <td style="padding: 4px 0; color: #1f2937; font-size: 14px;">${order.category}</td>
                                            </tr>` : ''}
                                            <tr>
                                                <td style="padding: 4px 0; color: #6b7280; font-size: 14px;"><strong>Orçamento:</strong></td>
                                                <td style="padding: 4px 0; color: #1f2937; font-size: 14px;">${budgetFormatted}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Texto + CTA -->
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <p style="margin: 0 0 25px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                Não se preocupe, você pode continuar navegando por outros pedidos disponíveis na plataforma e enviar novas propostas.
                            </p>

                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 10px 0;">
                                        <a href="https://cotaja.io" style="display: inline-block; padding: 14px 40px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                                            Ver Pedidos Disponíveis
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Assinatura -->
                    <tr>
                        <td style="padding: 20px 40px 30px 40px;">
                            <p style="margin: 0 0 5px 0; color: #4b5563; font-size: 16px;">Atenciosamente,</p>
                            <p style="margin: 0; color: #2563eb; font-size: 16px; font-weight: bold;">Equipe Cotaja</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #1f2937; padding: 30px 40px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;"><strong>COTAJA</strong></p>
                            <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">contato@cotaja.io<br>www.cotaja.io</p>
                            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 15px auto 0 auto;"><tr>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.instagram.com/cotaja.io" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#E1306C" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="white" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="white"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.kwai.com/@cotajaseumarke" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF8C00" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4v16M6 12l8-8M6 12l8 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 6l4 6-4 6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.tiktok.com/@cotaja.seu.market" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#010101" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://www.facebook.com/share/1ArvGRTDmo/" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#1877F2" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></td></tr></table></a>
                                </td>
                                <td align="center" valign="middle" style="padding: 0 4px;">
                                    <a href="https://youtube.com/@cotajaseumarketplacedeservicos" style="display: block; text-decoration: none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF0000" style="border-radius: 8px; width: 36px; height: 36px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96C1 8.12 1 12 1 12s0 3.88.46 5.58a2.78 2.78 0 0 0 1.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95C23 15.88 23 12 23 12s0-3.88-.46-5.58z" stroke="white" stroke-width="2"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg></td></tr></table></a>
                                </td>
                            </tr></table>
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 11px; line-height: 1.4;">
                                Este é um email automático, por favor não responda a esta mensagem.<br>
                                Caso tenha dúvidas, entre em contato através do nosso suporte.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `.trim();
    }

    getWebWelcomeDownloadAppTemplate(name, profileType) {
        const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.cotaja_rn';
        const appStoreUrl = 'https://apps.apple.com/br/app/cotaja/id6753153412';
        const isProvider = profileType === 'provider';
        const headline = isProvider
            ? 'Receba pedidos e cresça no CotaJá'
            : 'Encontre profissionais perto de você';
        const intro = isProvider
            ? 'Sua conta de prestador foi criada com sucesso. Baixe o app para receber pedidos, enviar propostas e gerenciar tudo pelo celular.'
            : 'Sua conta foi criada com sucesso. Baixe o app para criar pedidos, receber propostas e acompanhar tudo em tempo real.';
        const benefits = isProvider
            ? [
                'Receba pedidos de clientes da sua região',
                'Envie propostas e aumente seu faturamento',
                'Gerencie propostas e conversas no celular',
                'Construa reputação com avaliações verificadas',
                'Plano premium com 3 meses grátis para novos prestadores',
            ]
            : [
                'Crie pedidos de serviço em menos de 2 minutos',
                'Receba propostas de vários profissionais qualificados',
                'Compare preços, prazos e avaliações',
                'Acompanhe o andamento do serviço pelo app',
                'Receba alertas quando chegar nova proposta',
            ];
        const benefitsHtml = benefits.map((item) => (
            `<tr><td style="padding:0 0 10px 0;color:#4b5563;font-size:15px;line-height:1.5;">✓ ${item}</td></tr>`
        )).join('');
        return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;padding:20px 0;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
      <tr><td style="background-color:#ffffff;padding:36px 40px 26px 40px;text-align:center;border-bottom:3px solid #4f46e5;">
        <img src="cid:cotaja-logo" alt="Cotaja" style="max-width:220px;height:auto;display:block;margin:0 auto;" />
      </td></tr>
      <tr><td style="padding:36px 40px 10px 40px;">
        <h2 style="margin:0 0 16px 0;color:#4f46e5;font-size:22px;text-align:center;">${headline}</h2>
        <p style="margin:0 0 12px 0;color:#4b5563;font-size:15px;line-height:1.6;">Olá, <strong>${name || 'Olá'}</strong>!</p>
        <p style="margin:0 0 20px 0;color:#4b5563;font-size:15px;line-height:1.6;">${intro}</p>
        <p style="margin:0 0 12px 0;color:#1f2937;font-size:16px;font-weight:bold;">No app você pode:</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">${benefitsHtml}</table>
        <p style="margin:0 0 16px 0;color:#4b5563;font-size:15px;line-height:1.6;text-align:center;">Baixe grátis na loja do seu celular:</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:0 0 28px 0;">
          <a href="${playStoreUrl}" style="display:inline-block;padding:13px 24px;background-color:#16a34a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;margin:0 6px 8px 6px;">Google Play</a>
          <a href="${appStoreUrl}" style="display:inline-block;padding:13px 24px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;margin:0 6px 8px 6px;">App Store</a>
        </td></tr></table>
        <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;text-align:center;">Use o mesmo e-mail e senha do cadastro para entrar no app.</p>
      </td></tr>
      <tr><td style="padding:0 40px 28px 40px;">
        <p style="margin:0;color:#4b5563;font-size:15px;">Atenciosamente,</p>
        <p style="margin:4px 0 0;color:#4f46e5;font-size:15px;font-weight:bold;">Equipe Cotaja</p>
      </td></tr>
      <tr><td style="background-color:#1f2937;padding:26px 40px;text-align:center;">
        <p style="margin:0 0 6px 0;color:#ffffff;font-size:13px;font-weight:bold;">COTAJA</p>
        <p style="margin:0;color:#9ca3af;font-size:12px;">contato@cotaja.io · www.cotaja.io</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`.trim();
    }

    async sendWebWelcomeDownloadApp(user) {
        const subject = user.profile_type === 'provider'
            ? 'Baixe o app CotaJá e comece a receber pedidos'
            : 'Baixe o app CotaJá e crie seu primeiro pedido';
        const html = this.getWebWelcomeDownloadAppTemplate(user.name, user.profile_type);
        await this.transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME || 'Cotaja'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || process.env.MAIL_USER}>`,
            to: user.email,
            subject,
            html,
            attachments: [{ filename: 'logo.png', path: path.join(__dirname, '../../assets/images/logo.png'), cid: 'cotaja-logo' }],
        });
        console.log(`📧 [WebWelcome] "${subject}" → ${user.email}`);
        return { success: true };
    }
}

module.exports = new EmailService();
