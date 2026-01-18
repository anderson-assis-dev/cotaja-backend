const Notification = require('../models/Notification');
const User = require('../models/User');
const PushNotificationService = require('./PushNotificationService');

class NotificationService {
    constructor() {
        this.pushService = new PushNotificationService();
    }

    async createNotification(data) {
        try {
            return await Notification.create(data);
        } catch (error) {
            console.error('Erro ao criar notificação:', error);
            throw error;
        }
    }

    async notifyProvidersAboutNewOrder(order) {
        try {
            console.log(`🔔 Notificando providers sobre novo pedido: ${order.title}`);

            // Get ALL provider tokens for push notifications (not filtered by category)
            const providerTokens = await User.getProviderTokens();
            console.log(`📱 ${providerTokens.length} providers com tokens FCM`);

            // Find providers that work with the order category for database notifications
            const providers = await User.findProvidersByCategory(order.category);
            console.log(`📋 Encontrados ${providers.length} providers na categoria ${order.category}`);

            const notifications = [];

            // Create database notifications
            for (const provider of providers) {
                const notification = await this.createNotification({
                    user_id: provider.id,
                    type: Notification.TYPE_NEW_ORDER,
                    title: 'Novo Leilão Disponível',
                    message: order.title,
                    data: {
                        order_id: order.id,
                        order_title: order.title,
                        order_category: order.category,
                        order_budget: order.budget
                    }
                });
                notifications.push(notification);
            }

            // Send push notifications to ALL providers with tokens
            if (providerTokens.length > 0) {
                const pushTitle = 'Novo Leilão Disponível';
                const pushMessage = order.title;

                const pushResults = await this.pushService.sendBulkNotifications(
                    providerTokens,
                    pushTitle,
                    pushMessage,
                    {
                        sound: 'default',
                        data: {
                            type: 'new_order',
                            order_id: order.id,
                            order_title: order.title,
                            order_category: order.category,
                            order_budget: order.budget
                        }
                    }
                );

                console.log(`✅ Push notifications enviadas: ${pushResults.filter(r => r.success).length} sucesso, ${pushResults.filter(r => !r.success).length} falhas`);
            }

            return notifications;
        } catch (error) {
            console.error('Erro ao notificar prestadores sobre nova demanda:', error);
            throw error;
        }
    }

    async notifyClientAboutNewProposal(proposal) {
        try {
            // Load proposal with relations to get order and provider info
            await proposal.loadRelations();

            if (!proposal.order || !proposal.provider) {
                throw new Error('Dados da proposta incompletos');
            }

            return await this.createNotification({
                user_id: proposal.order.client_id,
                type: Notification.TYPE_NEW_PROPOSAL,
                title: 'Nova proposta recebida',
                message: `${proposal.provider.name} enviou uma proposta para "${proposal.order.title}"`,
                data: {
                    proposal_id: proposal.id,
                    order_id: proposal.order_id,
                    provider_id: proposal.provider_id,
                    provider_name: proposal.provider.name,
                    proposal_price: proposal.price
                }
            });
        } catch (error) {
            console.error('Erro ao notificar cliente sobre nova proposta:', error);
            throw error;
        }
    }

    async notifyProviderAboutProposalAccepted(proposal) {
        try {
            // Load proposal with relations
            await proposal.loadRelations();

            if (!proposal.order) {
                throw new Error('Dados da proposta incompletos');
            }

            return await this.createNotification({
                user_id: proposal.provider_id,
                type: Notification.TYPE_PROPOSAL_ACCEPTED,
                title: 'Proposta aceita!',
                message: `Sua proposta para "${proposal.order.title}" foi aceita!`,
                data: {
                    proposal_id: proposal.id,
                    order_id: proposal.order_id,
                    order_title: proposal.order.title,
                    proposal_price: proposal.price
                }
            });
        } catch (error) {
            console.error('Erro ao notificar prestador sobre proposta aceita:', error);
            throw error;
        }
    }

    async notifyProviderAboutProposalRejected(proposal) {
        try {
            // Load proposal with relations
            await proposal.loadRelations();

            if (!proposal.order) {
                throw new Error('Dados da proposta incompletos');
            }

            return await this.createNotification({
                user_id: proposal.provider_id,
                type: Notification.TYPE_PROPOSAL_REJECTED,
                title: 'Proposta rejeitada',
                message: `Sua proposta para "${proposal.order.title}" foi rejeitada.`,
                data: {
                    proposal_id: proposal.id,
                    order_id: proposal.order_id,
                    order_title: proposal.order.title,
                    proposal_price: proposal.price
                }
            });
        } catch (error) {
            console.error('Erro ao notificar prestador sobre proposta rejeitada:', error);
            throw error;
        }
    }
}

module.exports = new NotificationService();