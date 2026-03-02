const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const { createCustomer } = require('../services/StripeService');

const otpStore = new Map();

async function sendWelcomeEmail(user, activationToken) {
    try {
        const mailPort = parseInt(process.env.MAIL_PORT) || 465;
        const transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST || 'smtp.gmail.com',
            port: mailPort,
            secure: mailPort === 465,
            auth: {
                user: process.env.MAIL_USERNAME,
                pass: process.env.MAIL_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        });

        console.log('📧 Enviando email de boas-vindas para:', user.email);

        const serverUrl = process.env.SERVER_URL || 'http://159.195.32.169:53000';
        const activationLink = `${serverUrl}/api/auth/activate/${activationToken}`;

        await transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
            to: user.email,
            subject: 'Bem-vindo ao Cotaja! Ative sua conta',
            html: `
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
                                        <td style="background-color: #ffffff; padding: 40px 40px 30px 40px; text-align: center; border-bottom: 3px solid #2563eb;">
                                            <img src="cid:cotaja-logo" alt="Cotaja" style="max-width: 250px; height: auto; display: block; margin: 0 auto;" />
                                        </td>
                                    </tr>

                                    <!-- Ilustração -->
                                    <tr>
                                        <td style="padding: 40px 40px 20px 40px; text-align: center; background-color: #ffffff;">
                                            <img src="cid:register-email" alt="Bem-vindo ao Cotaja" style="max-width: 100%; height: auto; width: 400px; display: block; margin: 0 auto;" />
                                        </td>
                                    </tr>

                                    <!-- Conteúdo Principal -->
                                    <tr>
                                        <td style="padding: 20px 40px;">
                                            <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; text-align: center;">
                                                Prezado(a) ${user.name},
                                            </h2>

                                            <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                                Seja muito bem-vindo(a) ao <strong>Cotaja</strong>! Estamos muito felizes em tê-lo(a) conosco.
                                            </p>

                                            <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                                Sua conta foi criada com sucesso! Para começar a usar nossa plataforma, é necessário ativar sua conta clicando no botão abaixo:
                                            </p>

                                            <!-- Botão de Ativação -->
                                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                <tr>
                                                    <td align="center" style="padding: 20px 0;">
                                                        <a href="${activationLink}" style="display: inline-block; padding: 16px 48px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: bold;">
                                                            Ativar Minha Conta
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>

                                            <p style="margin: 0 0 15px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                                Após a ativação, você poderá fazer login e conectar-se com profissionais qualificados ou oferecer seus serviços.
                                            </p>

                                            <p style="margin: 0 0 25px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                                Caso tenha qualquer dúvida durante o processo ou precise de suporte adicional, estamos à disposição para ajudar.
                                            </p>

                                            <p style="margin: 0 0 10px 0; color: #9ca3af; font-size: 13px; line-height: 1.4; text-align: center;">
                                                Se o botão não funcionar, copie e cole este link no seu navegador:<br/>
                                                <a href="${activationLink}" style="color: #2563eb; word-break: break-all;">${activationLink}</a>
                                            </p>
                                        </td>
                                    </tr>

                                    <!-- Assinatura -->
                                    <tr>
                                        <td style="padding: 20px 40px 30px 40px;">
                                            <p style="margin: 0 0 5px 0; color: #4b5563; font-size: 16px;">
                                                Atenciosamente,
                                            </p>
                                            <p style="margin: 0; color: #2563eb; font-size: 16px; font-weight: bold;">
                                                Equipe Cotaja
                                            </p>
                                        </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                        <td style="background-color: #1f2937; padding: 30px 40px; text-align: center;">
                                            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px;">
                                                <strong>COTAJA</strong>
                                            </p>

                                            <p style="margin: 0 0 15px 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
                                                contato@cotaja.io<br>
                                                www.cotaja.io
                                            </p>

                                            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 15px auto 0 auto;"><tr>
                                                <td align="center" valign="middle" style="padding: 0 4px;"><a href="https://www.instagram.com/cotaja.io" style="display:block;text-decoration:none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#E1306C" style="border-radius:8px;width:36px;height:36px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;">in</td></tr></table></a></td>
                                                <td align="center" valign="middle" style="padding: 0 4px;"><a href="https://www.kwai.com/@cotajaseumarke" style="display:block;text-decoration:none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF8C00" style="border-radius:8px;width:36px;height:36px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;">K</td></tr></table></a></td>
                                                <td align="center" valign="middle" style="padding: 0 4px;"><a href="https://www.tiktok.com/@cotaja.seu.market" style="display:block;text-decoration:none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#010101" style="border-radius:8px;width:36px;height:36px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;">tt</td></tr></table></a></td>
                                                <td align="center" valign="middle" style="padding: 0 4px;"><a href="https://www.facebook.com/share/1ArvGRTDmo/" style="display:block;text-decoration:none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#1877F2" style="border-radius:8px;width:36px;height:36px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;">f</td></tr></table></a></td>
                                                <td align="center" valign="middle" style="padding: 0 4px;"><a href="https://youtube.com/@cotajaseumarketplacedeservicos" style="display:block;text-decoration:none;"><table width="36" height="36" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF0000" style="border-radius:8px;width:36px;height:36px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#ffffff;">YT</td></tr></table></a></td>
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
            `,
            attachments: [
                {
                    filename: 'logo.png',
                    path: path.join(__dirname, '../../assets/images/logo.png'),
                    cid: 'cotaja-logo'
                },
                {
                    filename: 'register-email.png',
                    path: path.join(__dirname, '../../assets/images/register-email.png'),
                    cid: 'register-email'
                }
            ]
        });

        console.log('✅ Email de boas-vindas enviado com sucesso para:', user.email);
    } catch (error) {
        console.error('❌ Erro ao enviar e-mail de boas-vindas:', error);
        throw error;
    }
}

async function sendOtpEmail(user, otp) {
    const mailPort = parseInt(process.env.MAIL_PORT) || 465;
    const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST || 'smtp.gmail.com',
        port: mailPort,
        secure: mailPort === 465,
        auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });

    await transporter.sendMail({
        from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
        to: user.email,
        subject: 'Cotaja — Código de verificação',
        html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f4;padding:20px 0;">
                <tr><td align="center">
                  <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="background-color:#ffffff;padding:40px 40px 30px 40px;text-align:center;border-bottom:3px solid #4f46e5;">
                        <img src="cid:cotaja-logo" alt="Cotaja" style="max-width:200px;height:auto;display:block;margin:0 auto;" />
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px 40px 20px 40px;">
                        <h2 style="margin:0 0 20px 0;color:#1f2937;font-size:22px;text-align:center;">Código de Verificação</h2>
                        <p style="margin:0 0 15px 0;color:#4b5563;font-size:16px;line-height:1.6;">Olá, <strong>${user.name}</strong>!</p>
                        <p style="margin:0 0 24px 0;color:#4b5563;font-size:16px;line-height:1.6;">
                          Use o código abaixo para redefinir sua senha. Ele é válido por <strong>10 minutos</strong>.
                        </p>
                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr><td align="center" style="padding:8px 0 32px 0;">
                            <div style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:36px;font-weight:bold;letter-spacing:12px;padding:18px 36px;border-radius:12px;">
                              ${otp}
                            </div>
                          </td></tr>
                        </table>
                        <p style="margin:0 0 10px 0;color:#9ca3af;font-size:13px;text-align:center;">
                          Se você não solicitou essa alteração, ignore este email.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color:#1f2937;padding:24px 40px;text-align:center;">
                        <p style="margin:0 0 8px 0;color:#ffffff;font-size:14px;"><strong>COTAJA</strong></p>
                        <p style="margin:0 0 12px 0;color:#9ca3af;font-size:13px;">contato@cotaja.io &nbsp;|&nbsp; www.cotaja.io</p>
                        <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>
                          <td style="padding:0 4px;"><a href="https://www.instagram.com/cotaja.io" style="display:block;text-decoration:none;"><table width="32" height="32" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#E1306C" style="border-radius:6px;width:32px;height:32px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#ffffff;">in</td></tr></table></a></td>
                          <td style="padding:0 4px;"><a href="https://www.kwai.com/@cotajaseumarke" style="display:block;text-decoration:none;"><table width="32" height="32" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF8C00" style="border-radius:6px;width:32px;height:32px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#ffffff;">K</td></tr></table></a></td>
                          <td style="padding:0 4px;"><a href="https://www.tiktok.com/@cotaja.seu.market" style="display:block;text-decoration:none;"><table width="32" height="32" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#010101" style="border-radius:6px;width:32px;height:32px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#ffffff;">tt</td></tr></table></a></td>
                          <td style="padding:0 4px;"><a href="https://www.facebook.com/share/1ArvGRTDmo/" style="display:block;text-decoration:none;"><table width="32" height="32" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#1877F2" style="border-radius:6px;width:32px;height:32px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;">f</td></tr></table></a></td>
                          <td style="padding:0 4px;"><a href="https://youtube.com/@cotajaseumarketplacedeservicos" style="display:block;text-decoration:none;"><table width="32" height="32" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="#FF0000" style="border-radius:6px;width:32px;height:32px;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;color:#ffffff;">YT</td></tr></table></a></td>
                        </tr></table>
                        <p style="margin:16px 0 0 0;color:#6b7280;font-size:11px;">Este é um email automático, por favor não responda a esta mensagem.</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
        `,
        attachments: [
            {
                filename: 'logo.png',
                path: path.join(__dirname, '../../assets/images/logo.png'),
                cid: 'cotaja-logo',
            },
        ],
    });
}

class AuthController {
    async register(req, res) {
        try {
            const { name, email, phone, password, profile_type, fcm_token, device_platform, mother_name, birth_date, address, zip_code, latitude, longitude } = req.body;

            console.log('📝 [BACKEND/REGISTER] Nome:', name);
            console.log('📧 [BACKEND/REGISTER] Email:', email);
            console.log('👤 [BACKEND/REGISTER] Profile Type:', profile_type || 'NÃO INFORMADO (padrão: client)');
            console.log('[SERVER] [BACKEND/REGISTER] FCM Token:', fcm_token ? fcm_token.substring(0, 30) + '...' : 'AUSENTE');
            console.log('[SERVER] [BACKEND/REGISTER] Platform:', device_platform || 'NÃO INFORMADA');
            console.log('📦 [BACKEND/REGISTER] Body completo:', JSON.stringify(req.body, null, 2));

            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(422).json({
                    success: false,
                    message: 'Erro, não foi possível cadastrar a sua conta nesse momento. Tente utilizar um email diferente.',
                });
            }

            const userData = {
                name,
                email,
                phone,
                password,
                profile_type: profile_type || 'client',
                mother_name: mother_name || null,
                birth_date: birth_date || null,
                address: address || null,
                zip_code: zip_code || null,
                latitude: latitude || null,
                longitude: longitude || null,
            };

            try {
                const stripeCustomer = await createCustomer({
                    name,
                    email,
                    phone: phone || undefined,
                    metadata: { profile_type: profile_type || 'client' },
                });
                userData.stripe_customer_id = stripeCustomer.id;
            } catch (stripeError) {
                console.error('Stripe customer creation failed (non-blocking):', stripeError.message);
            }

            if (fcm_token) {
                userData.fcm_token = fcm_token;
                userData.device_platform = device_platform || null;
            }

            const user = await User.create(userData);

            console.log('✅ Usuário criado com profile_type:', user.profile_type);
            if (fcm_token) {
                console.log('✅ FCM token salvo no registro:', fcm_token.substring(0, 20) + '...');
            }

            sendWelcomeEmail(user, user.activation_token).catch(error => {
                console.error('❌ Erro ao enviar e-mail de boas-vindas (background):', error.message);
            });

            return res.status(201).json({
                success: true,
                message: 'Cadastro realizado com sucesso! Verifique seu email para ativar sua conta.',
                data: {
                    user: user.toJSON(),
                    requiresActivation: true
                }
            });
        } catch (error) {
            console.error('Erro ao registrar usuário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async login(req, res) {
        try {
            const { email, password, fcm_token, device_platform } = req.body;

            console.log('🔐 [BACKEND/LOGIN] Email:', email);
            console.log('[SERVER] [BACKEND/LOGIN] FCM Token:', fcm_token ? fcm_token.substring(0, 30) + '...' : 'AUSENTE');
            console.log('[SERVER] [BACKEND/LOGIN] Platform:', device_platform || 'NÃO INFORMADA');
            console.log('📦 [BACKEND/LOGIN] Body completo:', JSON.stringify(req.body, null, 2));

            const user = await User.findByEmail(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciais inválidas'
                });
            }

            const isValidPassword = await user.verifyPassword(password);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciais inválidas'
                });
            }

            if (user.activate !== 1) {
                return res.status(403).json({
                    success: false,
                    message: 'Sua conta ainda não foi ativada. Verifique seu email para ativar sua conta.'
                });
            }

            if (!user.stripe_customer_id) {
                try {
                    const stripeCustomer = await createCustomer({
                        name: user.name,
                        email: user.email,
                        phone: user.phone || undefined,
                        metadata: { user_id: String(user.id) },
                    });
                    await user.update({ stripe_customer_id: stripeCustomer.id });
                } catch (stripeError) {
                    console.error('Stripe customer creation failed on login (non-blocking):', stripeError.message);
                }
            }

            if (fcm_token) {
                try {
                    await user.update({
                        fcm_token,
                        device_platform: device_platform || null
                    });
                    console.log(`✅ FCM token atualizado para usuário ${user.id}:`, fcm_token.substring(0, 20) + '...');
                    console.log(`✅ Platform: ${device_platform || 'não informada'}`);
                } catch (error) {
                    console.error('❌ Erro ao atualizar FCM token no login:', error);
                }
            } else {
                console.log('⚠️ Nenhum FCM token fornecido no login');
            }

            const token = generateToken({ userId: user.id });

            return res.json({
                success: true,
                message: 'Login realizado com sucesso',
                data: {
                    user: user.toJSON(),
                    token
                }
            });
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async logout(req, res) {
        return res.json({
            success: true,
            message: 'Logout realizado com sucesso'
        });
    }

    async me(req, res) {
        try {
            return res.json({
                success: true,
                data: {
                    user: req.user.toJSON()
                }
            });
        } catch (error) {
            console.error('Erro ao obter dados do usuário:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async updateProfile(req, res) {
        try {
            const updateData = {};

            const allowedFields = ['name', 'phone', 'address', 'profile_type', 'service_categories'];
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            const updatedUser = await req.user.update(updateData);

            return res.json({
                success: true,
                message: 'Perfil atualizado com sucesso',
                data: {
                    user: updatedUser.toJSON()
                }
            });
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async updateProfileType(req, res) {
        try {
            const { profile_type, service_categories } = req.body;

            const updateData = { profile_type };

            if (profile_type === 'provider' && service_categories !== undefined && service_categories !== null) {
                updateData.service_categories = service_categories;
            } else if (profile_type === 'client') {
                updateData.service_categories = null;
            }

            const updatedUser = await req.user.update(updateData);

            return res.json({
                success: true,
                message: 'Tipo de perfil atualizado com sucesso',
                data: {
                    user: updatedUser.toJSON()
                }
            });
        } catch (error) {
            console.error('Erro ao atualizar tipo de perfil:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async saveFcmToken(req, res) {
        try {
            const { fcm_token, device_platform } = req.body;

            console.log('[SERVER] Salvando FCM token para usuário:', req.user.id);
            console.log('[SERVER] Token:', fcm_token ? fcm_token.substring(0, 20) + '...' : 'Ausente');
            console.log('[SERVER] Platform:', device_platform || 'Não informada');

            if (!fcm_token) {
                return res.status(400).json({
                    success: false,
                    message: 'Token FCM não fornecido'
                });
            }

            const updateData = { fcm_token };
            if (device_platform) {
                updateData.device_platform = device_platform;
            }

            const updatedUser = await req.user.update(updateData);

            console.log('✅ Token FCM salvo com sucesso para usuário:', req.user.id);

            return res.json({
                success: true,
                message: 'Token FCM salvo com sucesso'
            });
        } catch (error) {
            console.error('❌ Erro ao salvar token FCM:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async activate(req, res) {
        try {
            const { token } = req.params;

            if (!token) {
                return res.status(400).send(this._activationPage('Erro', 'Token de ativação não fornecido.', false));
            }

            const user = await User.findByActivationToken(token);

            if (!user) {
                return res.status(404).send(this._activationPage('Token Inválido', 'O link de ativação é inválido ou já foi utilizado.', false));
            }

            if (user.activate === 1) {
                return res.status(200).send(this._activationPage('Conta Já Ativa', 'Sua conta já está ativa. Você já pode fazer login no aplicativo.', true));
            }

            await user.update({
                activate: 1,
                email_verified_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
                activation_token: null
            });

            console.log('✅ Conta ativada com sucesso para:', user.email);

            return res.status(200).send(this._activationPage('Conta Ativada!', `Parabéns ${user.name}! Sua conta foi ativada com sucesso. Agora você pode fazer login no aplicativo Cotaja.`, true));
        } catch (error) {
            console.error('❌ Erro ao ativar conta:', error);
            return res.status(500).send(this._activationPage('Erro', 'Ocorreu um erro ao ativar sua conta. Tente novamente mais tarde.', false));
        }
    }

    _activationPage(title, message, success) {
        const color = success ? '#16a34a' : '#dc2626';
        const icon = success ? '✓' : '✗';
        return `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title} - Cotaja</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
                    .card { background: white; border-radius: 12px; padding: 40px; max-width: 500px; width: 100%; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                    .icon { width: 80px; height: 80px; border-radius: 50%; background-color: ${color}; color: white; font-size: 40px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
                    h1 { color: #1f2937; font-size: 24px; margin-bottom: 16px; }
                    p { color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
                    .brand { color: #2563eb; font-weight: bold; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">${icon}</div>
                    <h1>${title}</h1>
                    <p>${message}</p>
                    <p class="brand">Cotaja</p>
                </div>
            </body>
            </html>
        `;
    }

    async updateAvatar(req, res) {
        try {
            const { avatar_base64 } = req.body;

            if (!avatar_base64) {
                return res.status(400).json({
                    success: false,
                    message: 'Imagem não fornecida'
                });
            }

            await req.user.update({ avatar_base64 });

            return res.json({
                success: true,
                message: 'Foto de perfil atualizada com sucesso',
                data: {
                    avatar_base64: avatar_base64
                }
            });
        } catch (error) {
            console.error('❌ Erro ao atualizar avatar:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    async requestOtp(req, res) {
        try {
            const user = req.user;
            const otp = String(crypto.randomInt(100000, 999999));
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            otpStore.set(user.id, { otp, expiresAt });
            await sendOtpEmail(user, otp);
            return res.json({ success: true, message: 'Código enviado para o seu email.' });
        } catch (error) {
            console.error('Erro ao enviar OTP:', error);
            return res.status(500).json({ success: false, message: 'Erro ao enviar código. Tente novamente.' });
        }
    }

    async changePasswordWithOtp(req, res) {
        try {
            const { otp, new_password } = req.body;
            const user = req.user;

            if (!otp || !new_password) {
                return res.status(400).json({ success: false, message: 'Código e nova senha são obrigatórios.' });
            }

            if (new_password.length < 6) {
                return res.status(400).json({ success: false, message: 'A senha deve ter no mínimo 6 caracteres.' });
            }

            const stored = otpStore.get(user.id);
            if (!stored) {
                return res.status(400).json({ success: false, message: 'Nenhum código foi solicitado. Solicite um novo código.' });
            }

            if (new Date() > stored.expiresAt) {
                otpStore.delete(user.id);
                return res.status(400).json({ success: false, message: 'O código expirou. Solicite um novo código.' });
            }

            if (stored.otp !== otp) {
                return res.status(400).json({ success: false, message: 'Código inválido.' });
            }

            const hashedPassword = await bcrypt.hash(new_password, 10);
            await user.update({ password: hashedPassword });
            otpStore.delete(user.id);

            return res.json({ success: true, message: 'Senha alterada com sucesso.' });
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
        }
    }
}

const authController = new AuthController();
module.exports = authController;