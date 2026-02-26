const Order = require('../models/Order');
const Proposal = require('../models/Proposal');
const User = require('../models/User');
const notificationService = require('../services/NotificationService');
const fileUploadService = require('../services/FileUploadService');
const emailService = require('../services/EmailService');
const PushNotificationService = require('../services/PushNotificationService');
const appleMapsService = require('../services/AppleMapsService');
const nodemailer = require('nodemailer');
const moment = require('moment');
const { pool } = require('../config/database');

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
            const t0 = Date.now();
            const user = req.user;

            if (!user.isClient()) {
                return res.status(403).json({
                    success: false,
                    message: 'Apenas clientes podem criar pedidos'
                });
            }

            const { title, description, category, budget, deadline, address, street, number, complement, neighborhood, city, state, zip_code, latitude, longitude } = req.body;

            // Build full address from structured fields if not provided
            let fullAddress = address;
            if (!fullAddress && street) {
                const parts = [street];
                if (number) parts[0] += `, ${number}`;
                if (complement) parts.push(complement);
                if (neighborhood) parts.push(neighborhood);
                if (city) parts.push(city);
                if (state) parts.push(state);
                if (zip_code) parts.push(zip_code);
                fullAddress = parts.join(', ');
            }

            let finalLat = latitude ? parseFloat(latitude) : null;
            let finalLng = longitude ? parseFloat(longitude) : null;
            let finalStreet = street || null;
            let finalNumber = number || null;
            let finalNeighborhood = neighborhood || null;
            let finalCity = city || null;
            let finalState = state ? state.substring(0, 2).toUpperCase() : null;
            let finalZipCode = zip_code || null;

            // Geocoding only if coordinates are missing
            if (fullAddress && (!finalLat || !finalLng)) {
                try {
                    console.log('🗺️ Forward geocoding endereço:', fullAddress);
                    const geocoded = await appleMapsService.forwardGeocode(fullAddress);
                    if (geocoded) {
                        finalLat = geocoded.latitude;
                        finalLng = geocoded.longitude;
                        if (!finalStreet && geocoded.street) finalStreet = geocoded.street;
                        if (!finalCity && geocoded.city) finalCity = geocoded.city;
                        if (!finalState && geocoded.state) finalState = geocoded.state.substring(0, 2).toUpperCase();
                        if (!finalZipCode && geocoded.zip_code) finalZipCode = geocoded.zip_code;
                        if (!finalNeighborhood && geocoded.neighborhood) finalNeighborhood = geocoded.neighborhood;
                    }
                } catch (geocodeError) {
                    console.error('⚠️ Geocoding falhou (continuando):', geocodeError.message);
                }
            } else if (finalLat && finalLng && !fullAddress) {
                try {
                    const reversed = await appleMapsService.reverseGeocode(finalLat, finalLng);
                    if (reversed) {
                        fullAddress = reversed.formatted_address;
                        if (!finalStreet) finalStreet = reversed.street;
                        if (!finalNumber) finalNumber = reversed.number;
                        if (!finalCity) finalCity = reversed.city;
                        if (!finalState) finalState = reversed.state ? reversed.state.substring(0, 2).toUpperCase() : null;
                        if (!finalZipCode) finalZipCode = reversed.zip_code;
                        if (!finalNeighborhood) finalNeighborhood = reversed.neighborhood;
                    }
                } catch (geocodeError) {
                    console.error('⚠️ Geocoding falhou (continuando):', geocodeError.message);
                }
            }

            const t1 = Date.now();

            // Process attachments if any
            let attachments = null;
            if (req.files && req.files.length > 0) {
                try {
                    attachments = await fileUploadService.processUploadedFiles(req.files, user.email, title);
                    console.log(`✅ ${attachments.length} arquivos processados em ${Date.now() - t1}ms`);
                } catch (error) {
                    console.error('Erro ao processar arquivos:', error);
                }
            }

            const t2 = Date.now();

            const order = await Order.create({
                title,
                description,
                category,
                budget,
                deadline,
                address: fullAddress,
                street: finalStreet,
                number: finalNumber,
                complement: complement || null,
                neighborhood: finalNeighborhood,
                city: finalCity,
                state: finalState,
                zip_code: finalZipCode,
                latitude: finalLat,
                longitude: finalLng,
                client_id: user.id,
                attachments: attachments ? JSON.stringify(attachments) : null
            });

            const t3 = Date.now();
            console.log(`✅ Pedido #${order.id} criado — total: ${t3 - t0}ms (geocode: ${t1 - t0}ms, files: ${t2 - t1}ms, db: ${t3 - t2}ms)`);

            // ── RESPONSE IMEDIATO — sem base64 no corpo ──
            // Retorna o pedido sem os dados pesados (base64) dos attachments
            const responseOrder = { ...order };
            if (responseOrder.attachments && Array.isArray(responseOrder.attachments)) {
                responseOrder.attachments = responseOrder.attachments.map(att => {
                    const { data, ...rest } = att;
                    return rest;
                });
            } else if (typeof responseOrder.attachments === 'string') {
                try {
                    const parsed = JSON.parse(responseOrder.attachments);
                    responseOrder.attachments = parsed.map(att => {
                        const { data, ...rest } = att;
                        return rest;
                    });
                } catch (e) { /* keep as-is */ }
            }

            res.status(201).json({
                success: true,
                message: 'Pedido criado com sucesso!',
                data: responseOrder
            });

            // ── Background: notificações + emails (já respondeu ao cliente) ──
            notificationService.notifyProvidersAboutNewOrder(order).catch(error => {
                console.error('❌ Erro notificações (background):', error.message);
            });
            module.exports.sendNewOrderEmails(order).catch(error => {
                console.error('❌ Erro e-mails (background):', error.message);
            });

            return;
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

            // Providers can view orders they own OR open orders (for detail view)
            if (user.isProvider() && order.provider_id !== user.id && order.status !== 'open') {
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

            const allowedFields = ['title', 'description', 'category', 'budget', 'deadline', 'address', 'street', 'number', 'complement', 'neighborhood', 'city', 'state', 'zip_code', 'latitude', 'longitude', 'status'];
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
                // Collect file paths to delete from disk
                const filesToDelete = [];
                existingAttachments = existingAttachments.filter(att => {
                    const attId = att.filename || att.original_name || att.path || '';
                    if (removedPaths.includes(attId)) {
                        // Track path for disk cleanup
                        if (att.path) filesToDelete.push(att.path);
                        return false;
                    }
                    return true;
                });

                // Delete removed files from disk
                if (filesToDelete.length > 0) {
                    fileUploadService.deleteFiles(filesToDelete).catch(err => {
                        console.error('⚠️ Erro ao deletar arquivos removidos:', err);
                    });
                }

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
                        const pushSvc = new PushNotificationService();
                        await pushSvc.sendBulkNotifications(
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

                // Send emails (fire-and-forget, não bloqueia a response)
                emailService.sendOrderDeletedToProviders(order, providersWithProposals).catch(error => {
                    console.error('❌ Erro ao enviar emails de exclusão (background):', error.message);
                });
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
            if (paginatedOrders.length > 0) {
                console.log('📤 Enviando pedidos - First order proposals:', paginatedOrders[0]?.proposals?.length || 0);
            } else {
                console.log('📤 Enviando pedidos - nenhum resultado');
            }

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

    // Cancel an in-progress order (client or provider)
    async cancel(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const { reason } = req.body;

            if (!reason || !reason.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'É necessário informar o motivo do cancelamento'
                });
            }

            const order = await Order.findById(id, true);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
            }

            // Check permissions — only client or assigned provider
            if (order.client_id !== user.id && order.provider_id !== user.id) {
                return res.status(403).json({ success: false, message: 'Acesso negado' });
            }

            // Can only cancel open or in_progress orders
            if (order.status !== Order.STATUS_OPEN && order.status !== Order.STATUS_IN_PROGRESS) {
                return res.status(400).json({
                    success: false,
                    message: 'Não é possível cancelar este pedido'
                });
            }

            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                await connection.execute(
                    'UPDATE orders SET status = ?, cancel_reason = ?, cancelled_by = ?, updated_at = NOW() WHERE id = ?',
                    [Order.STATUS_CANCELLED, reason.trim(), user.id, id]
                );

                // If there was an accepted proposal, update it too
                if (order.accepted_proposal_id) {
                    await connection.execute(
                        'UPDATE proposals SET status = ?, updated_at = NOW() WHERE id = ?',
                        ['cancelled', order.accepted_proposal_id]
                    );
                }

                await connection.commit();
            } catch (dbError) {
                await connection.rollback();
                throw dbError;
            } finally {
                connection.release();
            }

            // Determine who to notify (the other party)
            const isClient = user.id === order.client_id;
            const otherUserId = isClient ? order.provider_id : order.client_id;
            const cancellerRole = isClient ? 'cliente' : 'prestador';

            if (otherUserId) {
                const otherUser = await User.findById(otherUserId);

                if (otherUser) {
                    // Push notification
                    try {
                        if (otherUser.fcm_token) {
                            const pushSvc = new PushNotificationService();
                            await pushSvc.sendAlert({
                                registration_id: otherUser.fcm_token,
                                device: otherUser.device_platform || 'ios',
                                title: 'Pedido Cancelado',
                                message: `O pedido "${order.title}" foi cancelado pelo ${cancellerRole}.`,
                                sound: 'default'
                            });
                            console.log(`✅ Push de cancelamento enviado para ${otherUser.name}`);
                        }
                    } catch (pushError) {
                        console.error('Erro ao enviar push de cancelamento:', pushError.message);
                    }

                    // Email notification (fire-and-forget, não bloqueia a response)
                    emailService.sendOrderCancelledNotification(order, otherUser, user, reason.trim())
                        .then(() => console.log(`📧 Email de cancelamento enviado para ${otherUser.email}`))
                        .catch(emailError => console.error('❌ Erro ao enviar email de cancelamento (background):', emailError.message));

                    // DB notification
                    try {
                        const Notification = require('../models/Notification');
                        await Notification.create({
                            user_id: otherUserId,
                            type: 'order_cancelled',
                            title: 'Pedido cancelado',
                            message: `O pedido "${order.title}" foi cancelado pelo ${cancellerRole}.`,
                            data: {
                                order_id: order.id,
                                order_title: order.title,
                                cancelled_by: user.id,
                                cancel_reason: reason.trim()
                            }
                        });
                    } catch (notifError) {
                        console.error('Erro ao criar notificação de cancelamento:', notifError.message);
                    }
                }
            }

            return res.json({
                success: true,
                message: 'Pedido cancelado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao cancelar pedido:', error);
            return res.status(500).json({ success: false, message: 'Erro ao cancelar pedido' });
        }
    }

    // Schedule a date/time for the service
    async schedule(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const { scheduled_date } = req.body;

            if (!scheduled_date) {
                return res.status(400).json({
                    success: false,
                    message: 'É necessário informar a data e horário'
                });
            }

            const scheduledMoment = moment(scheduled_date);
            if (!scheduledMoment.isValid() || scheduledMoment.isBefore(moment())) {
                return res.status(400).json({
                    success: false,
                    message: 'A data deve ser válida e futura'
                });
            }

            const order = await Order.findById(id, true);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
            }

            if (order.client_id !== user.id && order.provider_id !== user.id) {
                return res.status(403).json({ success: false, message: 'Acesso negado' });
            }

            if (order.status !== Order.STATUS_IN_PROGRESS) {
                return res.status(400).json({
                    success: false,
                    message: 'Agendamento disponível apenas para pedidos em andamento'
                });
            }

            const isClient = user.id === order.client_id;

            const connection = await pool.getConnection();
            try {
                await connection.execute(
                    `UPDATE orders SET
                        scheduled_date = ?,
                        schedule_confirmed_by_client = ?,
                        schedule_confirmed_by_provider = ?,
                        schedule_reminder_1d_sent = 0,
                        schedule_reminder_1h_sent = 0,
                        updated_at = NOW()
                     WHERE id = ?`,
                    [
                        scheduledMoment.format('YYYY-MM-DD HH:mm:ss'),
                        isClient ? 1 : 0,
                        isClient ? 0 : 1,
                        id
                    ]
                );
            } finally {
                connection.release();
            }

            // Notify the other party
            const otherUserId = isClient ? order.provider_id : order.client_id;
            if (otherUserId) {
                const otherUser = await User.findById(otherUserId);
                const formattedDate = scheduledMoment.format('DD/MM/YYYY [às] HH:mm');

                if (otherUser) {
                    // Push
                    try {
                        if (otherUser.fcm_token) {
                            const pushSvc = new PushNotificationService();
                            await pushSvc.sendAlert({
                                registration_id: otherUser.fcm_token,
                                device: otherUser.device_platform || 'ios',
                                title: 'Agendamento Proposto',
                                message: `${user.name} propôs agendar "${order.title}" para ${formattedDate}. Confirme o agendamento.`,
                                sound: 'default'
                            });
                        }
                    } catch (pushError) {
                        console.error('Erro ao enviar push de agendamento:', pushError.message);
                    }

                    // DB notification
                    try {
                        const Notification = require('../models/Notification');
                        await Notification.create({
                            user_id: otherUserId,
                            type: 'schedule_proposed',
                            title: 'Agendamento proposto',
                            message: `${user.name} propôs agendar "${order.title}" para ${formattedDate}.`,
                            data: {
                                order_id: order.id,
                                scheduled_date: scheduled_date,
                                proposed_by: user.id
                            }
                        });
                    } catch (notifError) {
                        console.error('Erro ao criar notificação de agendamento:', notifError.message);
                    }
                }
            }

            const updatedOrder = await Order.findById(id, true);

            return res.json({
                success: true,
                message: 'Agendamento proposto com sucesso',
                data: updatedOrder
            });
        } catch (error) {
            console.error('Erro ao agendar:', error);
            return res.status(500).json({ success: false, message: 'Erro ao propor agendamento' });
        }
    }

    // Confirm a proposed schedule
    async confirmSchedule(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const order = await Order.findById(id, true);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
            }

            if (order.client_id !== user.id && order.provider_id !== user.id) {
                return res.status(403).json({ success: false, message: 'Acesso negado' });
            }

            if (!order.scheduled_date) {
                return res.status(400).json({ success: false, message: 'Nenhum agendamento proposto' });
            }

            const isClient = user.id === order.client_id;
            const field = isClient ? 'schedule_confirmed_by_client' : 'schedule_confirmed_by_provider';

            const connection = await pool.getConnection();
            try {
                await connection.execute(
                    `UPDATE orders SET ${field} = 1, updated_at = NOW() WHERE id = ?`,
                    [id]
                );
            } finally {
                connection.release();
            }

            // Re-read to check if both confirmed
            const refreshedOrder = await Order.findById(id, true);
            const bothConfirmed = refreshedOrder.schedule_confirmed_by_client && refreshedOrder.schedule_confirmed_by_provider;

            // Notify the other party
            const otherUserId = isClient ? order.provider_id : order.client_id;
            const formattedDate = moment(order.scheduled_date).format('DD/MM/YYYY [às] HH:mm');

            if (otherUserId) {
                const otherUser = await User.findById(otherUserId);
                if (otherUser) {
                    const pushTitle = bothConfirmed ? 'Agendamento Confirmado' : 'Agendamento Confirmado';
                    const pushMessage = bothConfirmed
                        ? `O serviço "${order.title}" foi confirmado por ambas as partes para ${formattedDate}!`
                        : `${user.name} confirmou o agendamento de "${order.title}" para ${formattedDate}.`;

                    try {
                        if (otherUser.fcm_token) {
                            const pushSvc = new PushNotificationService();
                            await pushSvc.sendAlert({
                                registration_id: otherUser.fcm_token,
                                device: otherUser.device_platform || 'ios',
                                title: pushTitle,
                                message: pushMessage,
                                sound: 'default'
                            });
                        }
                    } catch (pushError) {
                        console.error('Erro ao enviar push de confirmação:', pushError.message);
                    }

                    // DB notification
                    try {
                        const Notification = require('../models/Notification');
                        await Notification.create({
                            user_id: otherUserId,
                            type: 'schedule_confirmed',
                            title: pushTitle,
                            message: pushMessage,
                            data: {
                                order_id: order.id,
                                scheduled_date: order.scheduled_date,
                                both_confirmed: bothConfirmed
                            }
                        });
                    } catch (notifError) {
                        console.error('Erro ao criar notificação de confirmação:', notifError.message);
                    }

                    // Send email to both if both confirmed (fire-and-forget, não bloqueia a response)
                    if (bothConfirmed) {
                        (async () => {
                            try {
                                const client = await User.findById(order.client_id);
                                const provider = await User.findById(order.provider_id);
                                await emailService.sendScheduleConfirmedNotification(order, client, provider, formattedDate);
                            } catch (emailError) {
                                console.error('❌ Erro ao enviar email de confirmação (background):', emailError.message);
                            }
                        })();
                    }
                }
            }

            return res.json({
                success: true,
                message: bothConfirmed ? 'Agendamento confirmado por ambas as partes!' : 'Agendamento confirmado',
                data: refreshedOrder
            });
        } catch (error) {
            console.error('Erro ao confirmar agendamento:', error);
            return res.status(500).json({ success: false, message: 'Erro ao confirmar agendamento' });
        }
    }
}

module.exports = new OrderController();