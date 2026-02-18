const Proposal = require('../models/Proposal');
const Order = require('../models/Order');
const User = require('../models/User');
const notificationService = require('../services/NotificationService');
const emailService = require('../services/EmailService');
const { pool } = require('../config/database');
const nodemailer = require('nodemailer');

class ProposalController {
    async index(req, res) {
        try {
            const user = req.user;
            const { status, order_id, page = 1, limit = 10 } = req.query;

            let proposals = [];

            if (user.isProvider()) {
                proposals = await Proposal.findByProvider(user.id, {
                    status,
                    withRelations: true
                });
            } else if (user.isClient()) {
                // For clients, get proposals for their orders
                const connection = await pool.getConnection();
                try {
                    let query = `
                        SELECT p.*, o.client_id, u.name as provider_name, u.email as provider_email
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

                    query += ' ORDER BY p.created_at DESC';

                    const [rows] = await connection.execute(query, params);
                    proposals = rows.map(row => new Proposal(row));

                    // Load relations for each proposal
                    for (const proposal of proposals) {
                        await proposal.loadRelations(connection);
                    }
                } finally {
                    connection.release();
                }
            }

            // Simple pagination simulation
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

            // Check if order exists and is open
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

            // Check if provider already sent a proposal for this order
            const existingProposals = await Proposal.findByOrder(order_id, {
                provider_id: user.id
            });

            if (existingProposals.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Você já enviou uma proposta para este pedido'
                });
            }

            // Create proposal
            const proposal = await Proposal.create({
                order_id,
                provider_id: user.id,
                price,
                deadline,
                description,
                status: Proposal.STATUS_PENDING
            });

            // Load relations
            await proposal.loadRelations();

            // Notify client about new proposal
            try {
                await notificationService.notifyClientAboutNewProposal(proposal);
            } catch (error) {
                console.error('Erro ao enviar notificação:', error);
            }

            // Send email to client using EmailService
            try {
                const client = await User.findById(order.client_id);
                const provider = await User.findById(user.id);

                if (client && provider) {
                    await emailService.sendNewProposalToClient(order, proposal, client, provider);
                }
            } catch (error) {
                console.error('Erro ao enviar e-mail:', error);
            }

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

            // Check permissions
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

            // Check permissions
            if (user.isProvider() && proposal.provider_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            // Check if proposal can be updated
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

            // Check if user is the client of the order
            if (!user.isClient() || proposal.order.client_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            // Check if proposal is pending
            if (proposal.status !== Proposal.STATUS_PENDING) {
                return res.status(400).json({
                    success: false,
                    message: 'Esta proposta não pode ser aceita'
                });
            }

            // Check if order is open
            if (proposal.order.status !== Order.STATUS_OPEN) {
                return res.status(400).json({
                    success: false,
                    message: 'Este pedido não está mais aceitando propostas'
                });
            }

            // Start transaction
            await connection.beginTransaction();

            try {
                // Accept the proposal
                await connection.execute(
                    'UPDATE proposals SET status = ?, updated_at = NOW() WHERE id = ?',
                    [Proposal.STATUS_ACCEPTED, proposal.id]
                );

                // Reject other proposals for the same order
                await connection.execute(
                    'UPDATE proposals SET status = ?, updated_at = NOW() WHERE order_id = ? AND id != ?',
                    [Proposal.STATUS_REJECTED, proposal.order_id, proposal.id]
                );

                // Update the order
                await connection.execute(
                    'UPDATE orders SET status = ?, provider_id = ?, accepted_proposal_id = ?, updated_at = NOW() WHERE id = ?',
                    [Order.STATUS_IN_PROGRESS, proposal.provider_id, proposal.id, proposal.order_id]
                );

                await connection.commit();

                // Reload proposal with updated data
                const updatedProposal = await Proposal.findById(id, true);

                // Notify provider about accepted proposal
                try {
                    await notificationService.notifyProviderAboutProposalAccepted(updatedProposal);
                } catch (error) {
                    console.error('Erro ao enviar notificação de proposta aceita:', error);
                }

                // Send email to provider about accepted proposal
                try {
                    const provider = await User.findById(updatedProposal.provider_id);
                    if (provider) {
                        await emailService.sendProposalAcceptedToProvider(
                            updatedProposal.order || proposal.order,
                            updatedProposal,
                            provider
                        );
                    }
                } catch (error) {
                    console.error('Erro ao enviar email de proposta aceita:', error);
                }

                // Notify providers about rejected proposals
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

            // Check if user is the client of the order
            if (!user.isClient() || proposal.order.client_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            // Check if proposal is pending
            if (proposal.status !== Proposal.STATUS_PENDING) {
                return res.status(400).json({
                    success: false,
                    message: 'Esta proposta não pode ser rejeitada'
                });
            }

            await proposal.update({ status: Proposal.STATUS_REJECTED });

            // Notify provider about rejected proposal
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

            // Check if user is the provider of the proposal
            if (!user.isProvider() || proposal.provider_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            // Check if proposal is pending
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
            // Load relations if not already loaded
            if (!proposal.order || !proposal.provider) {
                await proposal.loadRelations();
            }

            const order = proposal.order;
            const provider = proposal.provider;

            // Get client data
            const client = await User.findById(order.client_id);
            if (!client) {
                throw new Error('Cliente não encontrado');
            }

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

            // Send mail
            await transporter.sendMail({
                from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
                to: client.email,
                subject: 'Nova proposta recebida - Cotaja',
                html: `
                    <h1>Nova proposta recebida!</h1>
                    <p>Olá, ${client.name}!</p>
                    <p>Você recebeu uma nova proposta de <strong>${provider.name}</strong> para seu pedido:</p>
                    <h3>${order.title}</h3>
                    <p><strong>Preço proposto:</strong> R$ ${proposal.price}</p>
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