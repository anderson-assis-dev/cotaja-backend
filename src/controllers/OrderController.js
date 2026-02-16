const Order = require('../models/Order');
const Proposal = require('../models/Proposal');
const User = require('../models/User');
const notificationService = require('../services/NotificationService');
const fileUploadService = require('../services/FileUploadService');
const emailService = require('../services/EmailService');
const pushNotificationService = require('../services/PushNotificationService');
const nodemailer = require('nodemailer');
const moment = require('moment');

class OrderController {
    async index(req, res) {
        try {
            const user = req.user;
            const { status, category, page = 1, limit = 10 } = req.query;

            let orders = [];

            if (user.isClient()) {
                orders = await Order.findByClient(user.id, {
                    status,
                    category,
                    withRelations: true
                });
            } else if (user.isProvider()) {
                orders = await Order.findByProvider(user.id, {
                    status,
                    category,
                    withRelations: true
                });
            }

            // Simple pagination simulation (in production, implement proper pagination)
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedOrders = orders.slice(startIndex, endIndex);

            const pagination = {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total: orders.length,
                last_page: Math.ceil(orders.length / limit),
                data: paginatedOrders
            };

            return res.json({
                success: true,
                data: pagination
            });
        } catch (error) {
            console.error('Erro ao listar pedidos:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async store(req, res) {
        try {
            console.log('Criando pedido', req.body);

            const user = req.user;

            if (!user.isClient()) {
                return res.status(403).json({
                    success: false,
                    message: 'Apenas clientes podem criar pedidos'
                });
            }

            const { title, description, category, budget, deadline, address } = req.body;

            // Process attachments if any
            let attachments = null;
            if (req.files && req.files.length > 0) {
                console.log(`📎 Processando ${req.files.length} arquivos anexados`);

                try {
                    // Process uploaded files (virus scan + metadata + move to final location)
                    attachments = await fileUploadService.processUploadedFiles(req.files, user.email, title);
                    console.log(`✅ ${attachments.length} arquivos processados com sucesso`);

                    if (attachments.length < req.files.length) {
                        console.log(`⚠️  ${req.files.length - attachments.length} arquivo(s) infectado(s) removido(s)`);
                    }
                } catch (error) {
                    console.error('Erro ao processar arquivos:', error);
                    // Continue even if file processing fails
                }
            }

            const order = await Order.create({
                title,
                description,
                category,
                budget,
                deadline,
                address,
                client_id: user.id,
                attachments: attachments ? JSON.stringify(attachments) : null
            });

            console.log('Pedido criado com sucesso', { order_id: order.id });

            // Load relations
            await order.loadRelations();

            // Notify providers about new order
            try {
                await notificationService.notifyProvidersAboutNewOrder(order);
            } catch (error) {
                console.error('Erro ao enviar notificações:', error);
            }

            // Send emails to providers
            try {
                await this.sendNewOrderEmails(order);
            } catch (error) {
                console.error('Erro ao enviar e-mails:', error);
            }

            return res.status(201).json({
                success: true,
                message: 'Pedido criado com sucesso!',
                data: order
            });
        } catch (error) {
            console.error('Erro ao criar pedido:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async show(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const order = await Order.findById(id, true);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            // Check permissions
            if (user.isClient() && order.client_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            if (user.isProvider() && order.provider_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            return res.json({
                success: true,
                data: order
            });
        } catch (error) {
            console.error('Erro ao obter pedido:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async update(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            // Check permissions
            if (user.isClient() && order.client_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            const allowedFields = ['title', 'description', 'category', 'budget', 'deadline', 'address', 'status'];
            const updateData = {};

            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            // Gerenciar anexos
            let existingAttachments = [];
            if (order.attachments) {
                try {
                    existingAttachments = typeof order.attachments === 'string'
                        ? JSON.parse(order.attachments)
                        : order.attachments;
                } catch (e) {
                    console.error('Erro ao parsear anexos existentes:', e);
                }
            }

            // Filtrar anexos removidos pelo cliente
            let removedPaths = [];
            if (req.body.removedAttachments) {
                try {
                    removedPaths = JSON.parse(req.body.removedAttachments);
                    console.log('🗑️ Anexos a remover:', removedPaths.length);
                } catch (e) {
                    console.error('Erro ao parsear removedAttachments:', e);
                }
            }

            if (removedPaths.length > 0) {
                existingAttachments = existingAttachments.filter(att => {
                    const attId = att.filename || att.original_name || att.path || '';
                    return !removedPaths.includes(attId);
                });
                console.log('📎 Anexos restantes após remoção:', existingAttachments.length);
            }

            // Processar novos anexos se houver
            let newAttachments = [];
            if (req.files && req.files.length > 0) {
                const fileUploadService = require('../services/FileUploadService');
                const { title } = req.body;

                newAttachments = await fileUploadService.processUploadedFiles(
                    req.files,
                    user.email,
                    title || order.title
                );
                console.log('📎 Novos anexos processados:', newAttachments.length);
            }

            // Atualizar anexos se houve remoção ou adição
            if (removedPaths.length > 0 || newAttachments.length > 0 || req.files) {
                const allAttachments = [...existingAttachments, ...newAttachments];
                updateData.attachments = JSON.stringify(allAttachments);
                console.log('💾 Total de anexos após atualização:', allAttachments.length);
            }

            const updatedOrder = await order.update(updateData);
            await updatedOrder.loadRelations();

            return res.json({
                success: true,
                message: 'Pedido atualizado com sucesso!',
                data: updatedOrder
            });
        } catch (error) {
            console.error('Erro ao atualizar pedido:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async destroy(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            // Check permissions
            if (user.isClient() && order.client_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            // Check if order can be deleted
            if (order.status !== Order.STATUS_OPEN) {
                return res.status(400).json({
                    success: false,
                    message: 'Não é possível excluir um pedido que não está aberto'
                });
            }

            // Get proposals for this order before deletion
            const proposals = await Proposal.findByOrder(id);
            console.log(`📧 Pedido tem ${proposals.length} proposta(s)`);

            // Get provider details for each proposal
            const providersWithProposals = [];
            for (const proposal of proposals) {
                const provider = await User.findById(proposal.provider_id);
                if (provider && provider.email) {
                    providersWithProposals.push(provider);
                }
            }

            // Delete attachments from filesystem
            if (order.attachments) {
                try {
                    const attachments = JSON.parse(order.attachments);
                    const filePaths = attachments.map(att => att.path);
                    await fileUploadService.deleteFiles(filePaths);
                    console.log(`🗑️  Deletados ${filePaths.length} arquivo(s) anexado(s)`);
                } catch (error) {
                    console.error('Erro ao deletar arquivos:', error);
                }
            }

            await order.delete();

            // Send notifications to providers who submitted proposals
            if (providersWithProposals.length > 0) {
                console.log(`📧 Enviando notificações para ${providersWithProposals.length} prestador(es)`);

                // Send push notifications
                try {
                    const providerTokens = providersWithProposals
                        .filter(p => p.fcm_token)
                        .map(p => p.fcm_token);

                    if (providerTokens.length > 0) {
                        await pushNotificationService.sendBulkNotifications(
                            providerTokens,
                            'Pedido Excluído',
                            `O pedido "${order.title}" foi excluído pelo cliente`,
                            {
                                type: 'order_deleted',
                                order_id: order.id,
                                order_title: order.title
                            }
                        );
                    }
                } catch (error) {
                    console.error('Erro ao enviar push notifications:', error);
                }

                // Send emails
                try {
                    await emailService.sendOrderDeletedToProviders(order, providersWithProposals);
                } catch (error) {
                    console.error('Erro ao enviar emails:', error);
                }
            }

            return res.json({
                success: true,
                message: 'Pedido excluído com sucesso!'
            });
        } catch (error) {
            console.error('Erro ao excluir pedido:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async available(req, res) {
        try {
            const user = req.user;

            if (!user.isProvider()) {
                return res.status(403).json({
                    success: false,
                    message: 'Apenas prestadores podem ver pedidos disponíveis'
                });
            }

            const { category, cep, page = 1, limit = 10 } = req.query;

            const orders = await Order.findOpen({
                category,
                cep,
                withRelations: true
            });

            // Simple pagination simulation
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedOrders = orders.slice(startIndex, endIndex);

            const pagination = {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total: orders.length,
                last_page: Math.ceil(orders.length / limit),
                data: paginatedOrders
            };

            // Debug log
            console.log('📤 Enviando pedidos - First order proposals:', paginatedOrders[0]?.proposals?.length || 0);
            const jsonStr = JSON.stringify(paginatedOrders[0]);
            console.log('📤 First order JSON length:', jsonStr.length);
            console.log('📤 JSON contains proposals?', jsonStr.includes('"proposals"'));
            console.log('📤 Proposals in JSON:', jsonStr.substring(jsonStr.indexOf('"proposals"'), jsonStr.indexOf('"proposals"') + 200));

            return res.json({
                success: true,
                data: pagination
            });
        } catch (error) {
            console.error('Erro ao listar pedidos disponíveis:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async startAuction(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            // Check if user is the client
            if (order.client_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Apenas o cliente pode iniciar o leilão'
                });
            }

            // Check if order is open
            if (order.status !== Order.STATUS_OPEN) {
                return res.status(400).json({
                    success: false,
                    message: 'Apenas pedidos abertos podem iniciar leilão'
                });
            }

            // Check if auction is already started
            if (order.auction_started_at) {
                return res.status(400).json({
                    success: false,
                    message: 'Leilão já foi iniciado'
                });
            }

            const now = new Date();
            const auctionEndsAt = moment().add(7, 'days').toDate();

            const updatedOrder = await order.update({
                auction_started_at: now,
                auction_ends_at: auctionEndsAt
            });

            await updatedOrder.loadRelations();

            return res.json({
                success: true,
                message: 'Leilão iniciado com sucesso!',
                data: updatedOrder
            });
        } catch (error) {
            console.error('Erro ao iniciar leilão:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao iniciar leilão'
            });
        }
    }

    async recent(req, res) {
        try {
            const user = req.user;

            if (!user.isClient()) {
                return res.status(403).json({
                    success: false,
                    message: 'Apenas clientes podem ver pedidos recentes'
                });
            }

            const orders = await Order.findRecent(user.id, 30, 5);

            return res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            console.error('Erro ao obter pedidos recentes:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async stats(req, res) {
        try {
            const user = req.user;

            if (!user.isClient()) {
                return res.status(403).json({
                    success: false,
                    message: 'Apenas clientes podem ver estatísticas'
                });
            }

            const stats = await Order.getClientStats(user.id);

            return res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async sendNewOrderEmails(order) {
        try {
            // Find providers that work with the order category
            const providers = await User.findProvidersByCategory(order.category);

            // Create transporter
            const transporter = nodemailer.createTransporter({
                host: process.env.MAIL_HOST,
                port: process.env.MAIL_PORT,
                secure: false,
                auth: {
                    user: process.env.MAIL_USERNAME,
                    pass: process.env.MAIL_PASSWORD
                }
            });

            for (const provider of providers) {
                try {
                    await transporter.sendMail({
                        from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
                        to: provider.email,
                        subject: 'Nova demanda disponível - Cotaja',
                        html: `
                            <h1>Nova demanda disponível!</h1>
                            <p>Olá, ${provider.name}!</p>
                            <p>Uma nova demanda na categoria <strong>${order.category}</strong> foi criada:</p>
                            <h3>${order.title}</h3>
                            <p><strong>Orçamento:</strong> R$ ${order.budget}</p>
                            <p><strong>Descrição:</strong> ${order.description}</p>
                            <p>Acesse nossa plataforma para mais detalhes e enviar sua proposta!</p>
                        `
                    });

                    console.log('E-mail de nova demanda enviado', {
                        order_id: order.id,
                        provider_id: provider.id,
                        provider_email: provider.email
                    });
                } catch (error) {
                    console.error('Erro ao enviar e-mail de nova demanda', {
                        order_id: order.id,
                        provider_id: provider.id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            console.error('Erro geral ao enviar e-mails de nova demanda', {
                order_id: order.id,
                error: error.message
            });
        }
    }
}

module.exports = new OrderController();