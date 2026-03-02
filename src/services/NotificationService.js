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

            const [providerTokens, providers] = await Promise.all([
                User.getProviderTokens(),
                User.findProvidersByCategory(order.category),
            ]);
            console.log(`📱 ${providerTokens.length} providers com tokens FCM`);
            console.log(`📋 Encontrados ${providers.length} providers na categoria ${order.category}`);

            const notificationPromises = providers.map(provider =>
                this.createNotification({
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
                }).catch(err => {
                    console.error(`⚠️ Erro ao criar notificação para provider ${provider.id}:`, err.message);
                    return null;
                })
            );

            const pushPromise = providerTokens.length > 0
                ? this.pushService.sendBulkNotifications(
                    providerTokens,
                    'Novo Leilão Disponível',
                    order.title,
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
                ).then(pushResults => {
                    console.log(`✅ Push notifications enviadas: ${pushResults.filter(r => r.success).length} sucesso, ${pushResults.filter(r => !r.success).length} falhas`);
                }).catch(err => {
                    console.error('⚠️ Erro ao enviar push notifications:', err.message);
                })
                : Promise.resolve();

            const [notifications] = await Promise.all([
                Promise.all(notificationPromises),
                pushPromise,
            ]);

            return notifications.filter(Boolean);
        } catch (error) {
            console.error('Erro ao notificar prestadores sobre nova demanda:', error);
            throw error;
        }
    }

    async notifyClientAboutNewProposal(proposal) {
        try {
            await proposal.loadRelations();

            if (!proposal.order || !proposal.provider) {
                throw new Error('Dados da proposta incompletos');
            }

            const notification = await this.createNotification({
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

            try {
                const client = await User.findById(proposal.order.client_id);
                if (client && client.fcm_token) {
                    console.log(`📱 Enviando push notification para cliente ${client.name} (${client.email})`);

                    const pushTitle = 'Nova proposta recebida!';
                    const pushMessage = `${proposal.provider.name} enviou uma proposta de R$ ${parseFloat(proposal.price).toFixed(2).replace('.', ',')} para "${proposal.order.title}"`;

                    await this.pushService.sendAlert({
                        registration_id: client.fcm_token,
                        device: client.device_platform || 'ios',
                        title: pushTitle,
                        message: pushMessage,
                        sound: 'default'
                    });

                    console.log(`✅ Push notification enviada para cliente ${client.name}`);
                } else {
                    console.log(`⚠️ Cliente ${proposal.order.client_id} não possui FCM token para push notification`);
                }
            } catch (pushError) {
                console.error('❌ Erro ao enviar push notification para cliente:', pushError.message);
            }

            return notification;
        } catch (error) {
            console.error('Erro ao notificar cliente sobre nova proposta:', error);
            throw error;
        }
    }

    async notifyProviderAboutProposalAccepted(proposal) {
        try {
            await proposal.loadRelations();

            if (!proposal.order) {
                throw new Error('Dados da proposta incompletos');
            }

            const notification = await this.createNotification({
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

            try {
                const provider = await User.findById(proposal.provider_id);
                if (provider && provider.fcm_token) {
                    console.log(`📱 Enviando push notification de proposta aceita para ${provider.name} (${provider.email})`);

                    const pushTitle = 'Proposta aceita!';
                    const pushMessage = `Sua proposta de R$ ${parseFloat(proposal.price).toFixed(2).replace('.', ',')} para "${proposal.order.title}" foi aceita pelo cliente!`;

                    await this.pushService.sendAlert({
                        registration_id: provider.fcm_token,
                        device: provider.device_platform || 'ios',
                        title: pushTitle,
                        message: pushMessage,
                        sound: 'default'
                    });

                    console.log(`✅ Push notification de proposta aceita enviada para ${provider.name}`);
                } else {
                    console.log(`⚠️ Prestador ${proposal.provider_id} não possui FCM token para push notification`);
                }
            } catch (pushError) {
                console.error('❌ Erro ao enviar push notification de proposta aceita:', pushError.message);
            }

            return notification;
        } catch (error) {
            console.error('Erro ao notificar prestador sobre proposta aceita:', error);
            throw error;
        }
    }

    async notifyProviderAboutProposalRejected(proposal) {
        try {
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