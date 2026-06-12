const Proposal = require('../models/Proposal');
const Order = require('../models/Order');
const User = require('../models/User');
const ProfileView = require('../models/ProfileView');
const notificationService = require('../services/NotificationService');
const emailService = require('../services/EmailService');
const { buildHttpsLink } = require('./DeepLinkController');
const { pool } = require('../config/database');
const nodemailer = require('nodemailer');

class ProposalController {
    async index(req, res) {
        try {
            const user = req.user;
            const { status, order_id, page = 1, limit = 10 } = req.query;

            let proposals = [];

            if (user.isProvider()) {
                if (order_id) {
                    proposals = await Proposal.findByOrder(order_id, {
                        withRelations: true,
                        status
                    });
                } else {
                    proposals = await Proposal.findByProvider(user.id, {
                        status,
                        withRelations: true
                    });
                }
            } else if (user.isClient()) {
                const connection = await pool.getConnection();
                try {
                    let query = `
                        SELECT p.*, o.client_id,
                               u.name as provider_name, u.email as provider_email,
                               u.is_premium as provider_is_premium, u.is_verified as provider_is_verified
                        FROM proposals p
                        LEFT JOIN orders o ON p.order_id = o.id
                        LEFT JOIN users u ON p.provider_id = u.id
                        WHERE o.client_id = ?
                    `;
                    const params = [user.id];

                    if (status) {
                        query += ' AND p.status = ?';
                        params.push(status);
                    }

                    if (order_id) {
                        query += ' AND p.order_id = ?';
                        params.push(order_id);
                    }

                    // Premium providers appear first, then by creation date
                    query += ' ORDER BY u.is_premium DESC, p.created_at ASC';

                    const [rows] = await connection.execute(query, params);
                    proposals = rows.map(row => new Proposal(row));

                    for (const proposal of proposals) {
                        await proposal.loadRelations(connection);
                    }
                } finally {
                    connection.release();
                }
            }

            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedProposals = proposals.slice(startIndex, endIndex);

            const pagination = {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total: proposals.length,
                last_page: Math.ceil(proposals.length / limit),
                data: paginatedProposals
            };

            return res.json({
                success: true,
                data: pagination
            });
        } catch (error) {
            console.error('Erro ao listar propostas:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async store(req, res) {
        try {
            const user = req.user;
            const { order_id, price, deadline, description } = req.body;

            if (!user.isProvider()) {
                return res.status(403).json({
                    success: false,
                    message: 'Apenas prestadores podem criar propostas'
                });
            }

            const order = await Order.findById(order_id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Pedido não encontrado'
                });
            }

            if (order.status !== Order.STATUS_OPEN) {
                return res.status(400).json({
                    success: false,
                    message: 'Este pedido não está mais aceitando propostas'
                });
            }

            // Monthly proposal limit for free providers
            if (!user.is_premium) {
                const connection = await pool.getConnection();
                try {
                    const [[{ total }]] = await connection.execute(
                        `SELECT COUNT(*) AS total FROM proposals
                         WHERE provider_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
                        [user.id]
                    );
                    if (total >= 10) {
                        return res.status(403).json({
                            success: false,
                            message: 'Você atingiu o limite de 10 propostas por mês. Assine o Premium para propostas ilimitadas.',
                            upgrade_required: true,
                        });
                    }
                } finally {
                    connection.release();
                }
            }

            const existingProposals = await Proposal.findByOrder(order_id, {
                provider_id: user.id
            });

            if (existingProposals.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Você já enviou uma proposta para este pedido'
                });
            }

            const proposal = await Proposal.create({
                order_id,
                provider_id: user.id,
                price,
                deadline,
                description,
                status: Proposal.STATUS_PENDING
            });

            await proposal.loadRelations();

            try {
                await notificationService.notifyClientAboutNewProposal(proposal);
            } catch (error) {
                console.error('Erro ao enviar notificação:', error);
            }

            (async () => {
                try {
                    const client = await User.findById(order.client_id);
                    const provider = await User.findById(user.id);

                    if (client && provider) {
                        await emailService.sendNewProposalToClient(order, proposal, client, provider, buildHttpsLink('order', order.id));
                    }
                } catch (error) {
                    console.error('❌ Erro ao enviar e-mail de proposta (background):', error.message);
                }
            })();

            return res.status(201).json({
                success: true,
                message: 'Proposta enviada com sucesso!',
                data: proposal
            });
        } catch (error) {
            console.error('Erro ao criar proposta:', error);
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

            const proposal = await Proposal.findById(id, true);
            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: 'Proposta não encontrada'
                });
            }

            if (user.isProvider() && proposal.provider_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            if (user.isClient() && proposal.order.client_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }
            if (user.isClient()) {
                pool.execute(
                    'UPDATE proposals SET view_count = view_count + 1 WHERE id = ?',
                    [proposal.id]
                ).catch(() => {});
            }

            return res.json({
                success: true,
                data: proposal
            });
        } catch (error) {
            console.error('Erro ao obter proposta:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async visibility(req, res) {
        try {
            const user = req.user;

            if (!user.isProvider()) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            const connection = await pool.getConnection();
            try {
                // Métricas de visualização das propostas do provider
                const [viewRows] = await connection.execute(
                    `SELECT
                        COUNT(*) AS total_proposals,
                        SUM(view_count) AS total_views,
                        SUM(CASE WHEN view_count > 0 THEN 1 ELSE 0 END) AS proposals_with_views,
                        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS total_accepted,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS total_pending
                     FROM proposals
                     WHERE provider_id = ?`,
                    [user.id]
                );

                // Visualizações nos últimos 7 dias (propostas atualizadas recentemente com views)
                const [weekRows] = await connection.execute(
                    `SELECT COALESCE(SUM(view_count), 0) AS views_this_week
                     FROM proposals
                     WHERE provider_id = ?
                       AND updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                       AND view_count > 0`,
                    [user.id]
                );

                const stats = viewRows[0];
                const totalProposals = Number(stats.total_proposals) || 0;
                const totalAccepted = Number(stats.total_accepted) || 0;

                const isPremium = user.is_premium === 1;
                const profileStats = await ProfileView.getStats(user.id, isPremium);

                const baseData = {
                    total_views: Number(stats.total_views) || 0,
                    views_this_week: Number(weekRows[0].views_this_week) || 0,
                    proposals_with_views: Number(stats.proposals_with_views) || 0,
                    total_proposals: totalProposals,
                    total_pending: Number(stats.total_pending) || 0,
                    total_accepted: totalAccepted,
                    conversion_rate: totalProposals > 0
                        ? Math.round((totalAccepted / totalProposals) * 100)
                        : 0,
                    is_premium: isPremium,
                    profile_views_today: profileStats.profile_views_today,
                    no_quote_today: profileStats.no_quote_today,
                    profile_viewers: profileStats.viewers,
                };

                // Analytics for all users: category breakdown + avg response time
                const [[categoryRows], [responseRow]] = await Promise.all([
                    connection.execute(
                        `SELECT
                           o.category,
                           COUNT(*) AS total,
                           SUM(CASE WHEN p.status = 'accepted' THEN 1 ELSE 0 END) AS accepted,
                           ROUND(SUM(CASE WHEN p.status = 'accepted' THEN 1 ELSE 0 END) / COUNT(*) * 100) AS rate
                         FROM proposals p
                         JOIN orders o ON o.id = p.order_id
                         WHERE p.provider_id = ?
                         GROUP BY o.category
                         ORDER BY rate DESC, total DESC
                         LIMIT 6`,
                        [user.id]
                    ),
                    connection.execute(
                        `SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, o.created_at, p.created_at))) AS avg_response_hours
                         FROM proposals p
                         JOIN orders o ON o.id = p.order_id
                         WHERE p.provider_id = ?
                           AND p.created_at <= DATE_ADD(o.created_at, INTERVAL 30 DAY)`,
                        [user.id]
                    ),
                ]);

                const category_breakdown = (Array.isArray(categoryRows) ? categoryRows : []).map(r => ({
                    category: r.category,
                    total: Number(r.total) || 0,
                    accepted: Number(r.accepted) || 0,
                    rate: Number(r.rate) || 0,
                }));

                const rawAvg = responseRow[0]?.avg_response_hours;
                const avg_response_hours = rawAvg == null ? null : Number(rawAvg);

                if (!isPremium) {
                    return res.json({
                        success: true,
                        data: { ...baseData, category_breakdown, avg_response_hours },
                    });
                }

                // Premium-only metrics
                const [[monthRow], [avgResponseRow], [rankRow], [historyRows]] = await Promise.all([
                    // Proposals this month
                    connection.execute(
                        `SELECT COUNT(*) AS proposals_this_month
                         FROM proposals
                         WHERE provider_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
                        [user.id]
                    ),
                    // Average position among competing proposals (lower = better)
                    connection.execute(
                        `SELECT AVG(rank_pos) AS avg_rank
                         FROM (
                           SELECT p.id,
                             (SELECT COUNT(*) + 1 FROM proposals p2
                              WHERE p2.order_id = p.order_id AND p2.created_at < p.created_at) AS rank_pos
                           FROM proposals p
                           WHERE p.provider_id = ? AND p.status = 'pending'
                         ) ranked`,
                        [user.id]
                    ),
                    // View trend: views last 30 days vs previous 30 days
                    connection.execute(
                        `SELECT
                           SUM(CASE WHEN updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN view_count ELSE 0 END) AS views_last_30d,
                           SUM(CASE WHEN updated_at BETWEEN DATE_SUB(NOW(), INTERVAL 60 DAY) AND DATE_SUB(NOW(), INTERVAL 30 DAY) THEN view_count ELSE 0 END) AS views_prev_30d
                         FROM proposals WHERE provider_id = ?`,
                        [user.id]
                    ),
                    // Monthly history — last 12 months
                    connection.execute(
                        `SELECT
                           DATE_FORMAT(p.created_at, '%Y-%m') AS month,
                           COUNT(*) AS total,
                           SUM(CASE WHEN p.status = 'accepted' THEN 1 ELSE 0 END) AS accepted
                         FROM proposals p
                         WHERE p.provider_id = ?
                         GROUP BY month
                         ORDER BY month DESC
                         LIMIT 12`,
                        [user.id]
                    ),
                ]);

                const viewsLast30d = Number(rankRow[0]?.views_last_30d) || 0;
                const viewsPrev30d = Number(rankRow[0]?.views_prev_30d) || 0;
                const viewTrend = viewsPrev30d > 0
                    ? Math.round(((viewsLast30d - viewsPrev30d) / viewsPrev30d) * 100)
                    : null;

                const monthly_history = (Array.isArray(historyRows) ? historyRows : []).map(r => ({
                    month: r.month,
                    total: Number(r.total) || 0,
                    accepted: Number(r.accepted) || 0,
                }));

                return res.json({
                    success: true,
                    data: {
                        ...baseData,
                        category_breakdown,
                        avg_response_hours,
                        proposals_this_month: Number(monthRow[0]?.proposals_this_month) || 0,
                        avg_rank_position: avgResponseRow[0]?.avg_rank
                            ? Math.round(Number(avgResponseRow[0].avg_rank))
                            : null,
                        views_last_30d: viewsLast30d,
                        view_trend_pct: viewTrend,
                        monthly_history,
                    }
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Erro ao buscar métricas de visibilidade:', error);
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

            const proposal = await Proposal.findById(id);
            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: 'Proposta não encontrada'
                });
            }

            if (user.isProvider() && proposal.provider_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            if (proposal.status !== Proposal.STATUS_PENDING) {
                return res.status(400).json({
                    success: false,
                    message: 'Não é possível atualizar uma proposta que não está pendente'
                });
            }

            const allowedFields = ['price', 'deadline', 'description'];
            const updateData = {};

            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            const updatedProposal = await proposal.update(updateData);
            await updatedProposal.loadRelations();

            try {
                await notificationService.notifyClientAboutNewProposal(updatedProposal);
            } catch (error) {
                console.error('Erro ao enviar notificação de proposta atualizada:', error);
            }

            (async () => {
                try {
                    const client = await User.findById(updatedProposal.order.client_id);
                    const provider = await User.findById(user.id);
                    if (client && provider) {
                        await emailService.sendNewProposalToClient(updatedProposal.order, updatedProposal, client, provider, buildHttpsLink('order', updatedProposal.order.id));
                    }
                } catch (error) {
                    console.error('Erro ao enviar e-mail de proposta atualizada (background):', error.message);
                }
            })();

            return res.json({
                success: true,
                message: 'Proposta atualizada com sucesso!',
                data: updatedProposal
            });
        } catch (error) {
            console.error('Erro ao atualizar proposta:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async accept(req, res) {
        const connection = await pool.getConnection();

        try {
            const { id } = req.params;
            const user = req.user;

            const proposal = await Proposal.findById(id, true);
            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: 'Proposta não encontrada'
                });
            }

            if (!user.isClient() || proposal.order.client_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            if (proposal.status !== Proposal.STATUS_PENDING) {
                return res.status(400).json({
                    success: false,
                    message: 'Esta proposta não pode ser aceita'
                });
            }

            if (proposal.order.status !== Order.STATUS_OPEN) {
                return res.status(400).json({
                    success: false,
                    message: 'Este pedido não está mais aceitando propostas'
                });
            }

            await connection.beginTransaction();

            try {
                await connection.execute(
                    'UPDATE proposals SET status = ?, accepted_at = NOW(), updated_at = NOW() WHERE id = ?',
                    [Proposal.STATUS_ACCEPTED, proposal.id]
                );

                await connection.execute(
                    'UPDATE proposals SET status = ?, updated_at = NOW() WHERE order_id = ? AND id != ?',
                    [Proposal.STATUS_REJECTED, proposal.order_id, proposal.id]
                );

                await connection.execute(
                    'UPDATE orders SET status = ?, provider_id = ?, accepted_proposal_id = ?, updated_at = NOW() WHERE id = ?',
                    [Order.STATUS_IN_PROGRESS, proposal.provider_id, proposal.id, proposal.order_id]
                );

                await connection.commit();

                const updatedProposal = await Proposal.findById(id, true);

                try {
                    await notificationService.notifyProviderAboutProposalAccepted(updatedProposal);
                } catch (error) {
                    console.error('Erro ao enviar notificação de proposta aceita:', error);
                }

                (async () => {
                    try {
                        const provider = await User.findById(updatedProposal.provider_id);
                        if (provider) {
                            await emailService.sendProposalAcceptedToProvider(
                                updatedProposal.order || proposal.order,
                                updatedProposal,
                                provider,
                                buildHttpsLink('order', (updatedProposal.order || proposal.order).id)
                            );
                        }
                    } catch (error) {
                        console.error('❌ Erro ao enviar email de proposta aceita (background):', error.message);
                    }
                })();

                try {
                    const rejectedProposals = await Proposal.findByOrder(proposal.order_id, {
                        status: Proposal.STATUS_REJECTED,
                        withRelations: true
                    });

                    for (const rejectedProposal of rejectedProposals) {
                        if (rejectedProposal.id !== proposal.id) {
                            await notificationService.notifyProviderAboutProposalRejected(rejectedProposal);
                        }
                    }
                } catch (error) {
                    console.error('Erro ao enviar notificações de propostas rejeitadas:', error);
                }

                return res.json({
                    success: true,
                    message: 'Proposta aceita com sucesso!',
                    data: updatedProposal
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            }
        } catch (error) {
            console.error('Erro ao aceitar proposta:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao aceitar proposta'
            });
        } finally {
            connection.release();
        }
    }

    async cancelAcceptance(req, res) {
        const connection = await pool.getConnection();

        try {
            const { id } = req.params;
            const user = req.user;

            const proposal = await Proposal.findById(id, true);
            if (!proposal) {
                return res.status(404).json({ success: false, message: 'Proposta não encontrada' });
            }

            if (!user.isClient() || proposal.order.client_id !== user.id) {
                return res.status(403).json({ success: false, message: 'Acesso negado' });
            }

            if (proposal.status !== Proposal.STATUS_ACCEPTED) {
                return res.status(400).json({ success: false, message: 'Esta proposta não está aceita' });
            }

            if (proposal.order.status !== Order.STATUS_IN_PROGRESS) {
                return res.status(400).json({ success: false, message: 'O pedido não está em andamento' });
            }

            if (proposal.order.scheduled_date) {
                return res.status(400).json({
                    success: false,
                    message: 'Não é possível cancelar a aceitação após um agendamento ter sido proposto'
                });
            }

            await connection.beginTransaction();

            try {
                // Revert accepted proposal to pending
                await connection.execute(
                    'UPDATE proposals SET status = ?, accepted_at = NULL, updated_at = NOW() WHERE id = ?',
                    [Proposal.STATUS_PENDING, proposal.id]
                );

                // Revert all rejected proposals for this order back to pending
                await connection.execute(
                    'UPDATE proposals SET status = ?, updated_at = NOW() WHERE order_id = ? AND status = ? AND id != ?',
                    [Proposal.STATUS_PENDING, proposal.order_id, Proposal.STATUS_REJECTED, proposal.id]
                );

                // Revert order to open
                await connection.execute(
                    'UPDATE orders SET status = ?, provider_id = NULL, accepted_proposal_id = NULL, updated_at = NOW() WHERE id = ?',
                    [Order.STATUS_OPEN, proposal.order_id]
                );

                await connection.commit();

                try {
                    const freshProposal = await Proposal.findById(proposal.id, true);
                    if (freshProposal) {
                        await notificationService.notifyProviderAboutAcceptanceCancelled(freshProposal);
                    }
                } catch (error) {
                    console.error('Erro ao enviar notificação de cancelamento de aceitação:', error);
                }

                return res.json({
                    success: true,
                    message: 'Aceitação cancelada. Você pode selecionar outra proposta.'
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            }
        } catch (error) {
            console.error('Erro ao cancelar aceitação:', error);
            return res.status(500).json({ success: false, message: 'Erro ao cancelar aceitação' });
        } finally {
            connection.release();
        }
    }

    async reject(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const proposal = await Proposal.findById(id, true);
            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: 'Proposta não encontrada'
                });
            }

            if (!user.isClient() || proposal.order.client_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            if (proposal.status !== Proposal.STATUS_PENDING) {
                return res.status(400).json({
                    success: false,
                    message: 'Esta proposta não pode ser rejeitada'
                });
            }

            await proposal.update({ status: Proposal.STATUS_REJECTED });

            try {
                await notificationService.notifyProviderAboutProposalRejected(proposal);
            } catch (error) {
                console.error('Erro ao enviar notificação:', error);
            }

            return res.json({
                success: true,
                message: 'Proposta rejeitada com sucesso!'
            });
        } catch (error) {
            console.error('Erro ao rejeitar proposta:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async withdraw(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const proposal = await Proposal.findById(id);
            if (!proposal) {
                return res.status(404).json({
                    success: false,
                    message: 'Proposta não encontrada'
                });
            }

            if (!user.isProvider() || proposal.provider_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            if (proposal.status !== Proposal.STATUS_PENDING) {
                return res.status(400).json({
                    success: false,
                    message: 'Esta proposta não pode ser cancelada'
                });
            }

            await proposal.update({ status: Proposal.STATUS_WITHDRAWN });

            return res.json({
                success: true,
                message: 'Proposta cancelada com sucesso!'
            });
        } catch (error) {
            console.error('Erro ao cancelar proposta:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async sendNewProposalEmail(proposal) {
        try {
            if (!proposal.order || !proposal.provider) {
                await proposal.loadRelations();
            }

            const order = proposal.order;
            const provider = proposal.provider;

            const client = await User.findById(order.client_id);
            if (!client) {
                throw new Error('Cliente não encontrado');
            }

            const transporter = nodemailer.createTransporter({
                host: process.env.MAIL_HOST,
                port: process.env.MAIL_PORT,
                secure: false,
                auth: {
                    user: process.env.MAIL_USERNAME,
                    pass: process.env.MAIL_PASSWORD
                }
            });

            await transporter.sendMail({
                from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
                to: client.email,
                subject: 'Nova proposta recebida - Cotaja',
                html: `
                    <h1>Nova proposta recebida!</h1>
                    <p>Olá, ${client.name}!</p>
                    <p>Você recebeu uma nova proposta de <strong>${provider.name}</strong> para seu pedido:</p>
                    <h3>${order.title}</h3>
                    <p><strong>Preço proposto:</strong> R$ ${parseFloat(proposal.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p><strong>Prazo:</strong> ${proposal.deadline}</p>
                    <p><strong>Descrição:</strong> ${proposal.description}</p>
                    <p>Acesse nossa plataforma para mais detalhes e aceitar ou rejeitar a proposta!</p>
                `
            });

            console.log('E-mail de nova proposta enviado', {
                proposal_id: proposal.id,
                order_id: order.id,
                client_id: client.id,
                client_email: client.email
            });
        } catch (error) {
            console.error('Erro ao enviar e-mail de nova proposta', {
                proposal_id: proposal.id,
                order_id: proposal.order_id,
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = new ProposalController();