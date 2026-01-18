const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const nodemailer = require('nodemailer');
const path = require('path');

// Helper function to send welcome email
async function sendWelcomeEmail(user) {
    try {
        // Create transporter for Gmail
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.MAIL_USERNAME,
                pass: process.env.MAIL_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        console.log('📧 Enviando email de boas-vindas para:', user.email);

        // Send mail with embedded image
        await transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
            to: user.email,
            subject: 'Bem-vindo ao Cotaja!',
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
                                                Sua conta foi criada com sucesso e agora você já pode começar a usar nossa plataforma para conectar-se com profissionais qualificados ou oferecer seus serviços.
                                            </p>

                                            <p style="margin: 0 0 25px 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: justify;">
                                                Caso tenha qualquer dúvida durante o processo ou precise de suporte adicional, estamos à disposição para ajudar.
                                            </p>

                                            <!-- Botão de Ação -->
                                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                <tr>
                                                    <td align="center" style="padding: 10px 0;">
                                                        <a href="https://cotaja.io" style="display: inline-block; padding: 14px 40px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                                                            Acessar Plataforma
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
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

                                            <div style="margin: 15px 0 0 0;">
                                                <a href="https://instagram.com/cotaja" style="display: inline-block; margin: 0 8px;">
                                                    <span style="color: #ff6b35; font-size: 20px;">📷</span>
                                                </a>
                                                <a href="https://linkedin.com/company/cotaja" style="display: inline-block; margin: 0 8px;">
                                                    <span style="color: #ff6b35; font-size: 20px;">💼</span>
                                                </a>
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

class AuthController {
    async register(req, res) {
        try {
            const { name, email, phone, password, profile_type, fcm_token, device_platform } = req.body;

            console.log('📝 [BACKEND/REGISTER] Nome:', name);
            console.log('📧 [BACKEND/REGISTER] Email:', email);
            console.log('👤 [BACKEND/REGISTER] Profile Type:', profile_type || 'NÃO INFORMADO (padrão: client)');
            console.log('📱 [BACKEND/REGISTER] FCM Token:', fcm_token ? fcm_token.substring(0, 30) + '...' : 'AUSENTE');
            console.log('📱 [BACKEND/REGISTER] Platform:', device_platform || 'NÃO INFORMADA');
            console.log('📦 [BACKEND/REGISTER] Body completo:', JSON.stringify(req.body, null, 2));

            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(422).json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: {
                        email: {
                            msg: 'Não foi possível realizar o seu cadastro. Tente novamente.',
                        }
                    }
                });
            }

            // Create user with profile_type and FCM token
            const userData = {
                name,
                email,
                phone,
                password,
                profile_type: profile_type || 'client',
            };

            if (fcm_token) {
                userData.fcm_token = fcm_token;
                userData.device_platform = device_platform || null;
            }

            const user = await User.create(userData);

            console.log('✅ Usuário criado com profile_type:', user.profile_type);
            if (fcm_token) {
                console.log('✅ FCM token salvo no registro:', fcm_token.substring(0, 20) + '...');
            }

            // Generate token
            const token = generateToken({ userId: user.id });

            // Send welcome email
            try {
                await sendWelcomeEmail(user);
            } catch (error) {
                console.error('Erro ao enviar e-mail de boas-vindas:', error.message);
            }

            return res.status(201).json({
                success: true,
                message: 'Usuário registrado com sucesso',
                data: {
                    user: user.toJSON(),
                    token
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
            console.log('📱 [BACKEND/LOGIN] FCM Token:', fcm_token ? fcm_token.substring(0, 30) + '...' : 'AUSENTE');
            console.log('📱 [BACKEND/LOGIN] Platform:', device_platform || 'NÃO INFORMADA');
            console.log('📦 [BACKEND/LOGIN] Body completo:', JSON.stringify(req.body, null, 2));

            // Find user by email
            const user = await User.findByEmail(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciais inválidas'
                });
            }

            // Verify password
            const isValidPassword = await user.verifyPassword(password);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciais inválidas'
                });
            }

            // Update FCM token if provided
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
                    // Don't fail login if FCM token update fails
                }
            } else {
                console.log('⚠️ Nenhum FCM token fornecido no login');
            }

            // Generate token
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
        // In JWT implementation, logout is handled on client side
        // Server can optionally implement token blacklisting
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

            // Only include fields that are provided
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

            // If provider and has service_categories, save them
            if (profile_type === 'provider' && service_categories !== undefined && service_categories !== null) {
                updateData.service_categories = service_categories;
            } else if (profile_type === 'client') {
                // If client, clear service_categories
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

            console.log('📱 Salvando FCM token para usuário:', req.user.id);
            console.log('📱 Token:', fcm_token ? fcm_token.substring(0, 20) + '...' : 'Ausente');
            console.log('📱 Platform:', device_platform || 'Não informada');

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
}

const authController = new AuthController();
module.exports = authController;