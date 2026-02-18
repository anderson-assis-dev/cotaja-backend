const nodemailer = require('nodemailer');
const path = require('path');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            host: process.env.MAIL_HOST || 'smtp.gmail.com',
            port: process.env.MAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.MAIL_USERNAME || process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD || process.env.MAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    /**
     * Notifica prestadores quando um pedido é excluído
     */
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

    /**
     * Notifica cliente quando recebe uma proposta
     */
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

    /**
     * Template HTML para notificação de nova proposta (mesmo estilo do email de registro)
     */
    getNewProposalTemplate(order, proposal, provider, client) {
        const priceFormatted = parseFloat(proposal.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px 40px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;"><strong>COTAJA</strong></p>
                            <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">contato@cotaja.io<br>www.cotaja.io</p>
                            <div style="margin: 15px 0 0 0;">
                                <a href="https://instagram.com/cotaja" style="display: inline-block; margin: 0 8px;"><span style="color: #ff6b35; font-size: 20px;">📷</span></a>
                                <a href="https://linkedin.com/company/cotaja" style="display: inline-block; margin: 0 8px;"><span style="color: #ff6b35; font-size: 20px;">💼</span></a>
                            </div>
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

    /**
     * Notifica prestador quando sua proposta é aceita
     */
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

    /**
     * Notifica sobre cancelamento de pedido
     */
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

    /**
     * Notifica sobre agendamento confirmado por ambas as partes
     */
    async sendScheduleConfirmedNotification(order, client, provider, formattedDate) {
        try {
            const recipients = [client, provider].filter(u => u && u.email);

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

    /**
     * Envia lembrete de serviço agendado
     */
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

    /**
     * Template HTML para notificação de proposta aceita
     */
    getProposalAcceptedTemplate(order, proposal, provider) {
        const priceFormatted = parseFloat(proposal.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px 40px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;"><strong>COTAJA</strong></p>
                            <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">contato@cotaja.io<br>www.cotaja.io</p>
                            <div style="margin: 15px 0 0 0;">
                                <a href="https://instagram.com/cotaja" style="display: inline-block; margin: 0 8px;"><span style="color: #ff6b35; font-size: 20px;">📷</span></a>
                                <a href="https://linkedin.com/company/cotaja" style="display: inline-block; margin: 0 8px;"><span style="color: #ff6b35; font-size: 20px;">💼</span></a>
                            </div>
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

    /**
     * Template HTML para notificação de cancelamento
     */
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

    /**
     * Template HTML para agendamento confirmado
     */
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

    /**
     * Template HTML para lembrete de agendamento
     */
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

    /**
     * Template HTML para notificação de pedido excluído (mesmo estilo do email de registro)
     */
    getOrderDeletedTemplate(order, provider) {
        const budgetFormatted = order.budget ? `R$ ${parseFloat(order.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Não informado';

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

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px 40px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;"><strong>COTAJA</strong></p>
                            <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">contato@cotaja.io<br>www.cotaja.io</p>
                            <div style="margin: 15px 0 0 0;">
                                <a href="https://instagram.com/cotaja" style="display: inline-block; margin: 0 8px;"><span style="color: #ff6b35; font-size: 20px;">📷</span></a>
                                <a href="https://linkedin.com/company/cotaja" style="display: inline-block; margin: 0 8px;"><span style="color: #ff6b35; font-size: 20px;">💼</span></a>
                            </div>
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
}

module.exports = new EmailService();
