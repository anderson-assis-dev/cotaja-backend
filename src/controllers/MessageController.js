const Message = require('../models/Message');
const Order = require('../models/Order');
const User = require('../models/User');
const PushNotificationService = require('../services/PushNotificationService');

class MessageController {
    // List messages for an order
    async index(req, res) {
        try {
            const { orderId } = req.params;
            const user = req.user;
            const { page = 1, limit = 50 } = req.query;

            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
            }

            // Only client or assigned provider can see messages
            if (order.client_id !== user.id && order.provider_id !== user.id) {
                return res.status(403).json({ success: false, message: 'Acesso negado' });
            }

            // Order must be in_progress
            if (order.status !== Order.STATUS_IN_PROGRESS) {
                return res.status(400).json({ success: false, message: 'Chat disponível apenas para pedidos em andamento' });
            }

            // Mark messages as read for this user
            await Message.markAsRead(orderId, user.id);

            const result = await Message.findByOrder(orderId, { page: parseInt(page), limit: parseInt(limit) });

            return res.json({
                success: true,
                data: {
                    messages: result.messages,
                    total: result.total,
                    page: result.page,
                    limit: result.limit
                }
            });
        } catch (error) {
            console.error('Erro ao listar mensagens:', error);
            return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Send a message
    async store(req, res) {
        try {
            const { orderId } = req.params;
            const user = req.user;
            const { content } = req.body;

            if (!content || !content.trim()) {
                return res.status(400).json({ success: false, message: 'Mensagem não pode ser vazia' });
            }

            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
            }

            // Only client or assigned provider can send messages
            if (order.client_id !== user.id && order.provider_id !== user.id) {
                return res.status(403).json({ success: false, message: 'Acesso negado' });
            }

            if (order.status !== Order.STATUS_IN_PROGRESS) {
                return res.status(400).json({ success: false, message: 'Chat disponível apenas para pedidos em andamento' });
            }

            // Determine receiver
            const receiverId = user.id === order.client_id ? order.provider_id : order.client_id;

            const message = await Message.create({
                order_id: orderId,
                sender_id: user.id,
                receiver_id: receiverId,
                content: content.trim()
            });

            // Send push notification to receiver
            try {
                const receiver = await User.findById(receiverId);
                const sender = await User.findById(user.id);
                const senderName = sender ? sender.name : 'Alguém';

                if (receiver && receiver.fcm_token) {
                    const pushSvc = new PushNotificationService();
                    await pushSvc.sendAlert({
                        registration_id: receiver.fcm_token,
                        device: receiver.device_platform || 'ios',
                        title: `Nova mensagem - ${order.title}`,
                        message: `${senderName}: ${content.trim().substring(0, 100)}`,
                        sound: 'default',
                        extra_data: {
                            type: 'chat_message',
                            order_id: String(orderId),
                            sender_name: senderName
                        }
                    });
                    console.log(`Push notification de chat enviado para user ${receiverId} (pedido ${orderId})`);
                }
            } catch (pushError) {
                console.error('Erro ao enviar push de mensagem:', pushError.message);
            }

            return res.status(201).json({
                success: true,
                message: 'Mensagem enviada',
                data: message
            });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
        }
    }

    // Get unread count
    async unreadCount(req, res) {
        try {
            const { orderId } = req.params;
            const user = req.user;

            const count = await Message.getUnreadCount(orderId, user.id);

            return res.json({ success: true, data: { unread_count: count } });
        } catch (error) {
            console.error('Erro ao contar mensagens não lidas:', error);
            return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
        }
    }
}

module.exports = new MessageController();
