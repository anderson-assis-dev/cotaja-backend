const Notification = require('../models/Notification');

class NotificationController {
    async index(req, res) {
        try {
            const user = req.user;
            const { unread_only = false, page = 1, limit = 20 } = req.query;

            const options = {
                limit: parseInt(limit)
            };

            if (unread_only === 'true' || unread_only === true) {
                options.unread = true;
            }

            const notifications = await Notification.findByUser(user.id, options);
            const unreadCount = await Notification.getUnreadCount(user.id);

            // Simple pagination simulation
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedNotifications = notifications.slice(startIndex, endIndex);

            return res.json({
                success: true,
                notifications: paginatedNotifications,
                unread_count: unreadCount
            });
        } catch (error) {
            console.error('Erro ao listar notificações:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async unreadCount(req, res) {
        try {
            const user = req.user;
            const count = await Notification.getUnreadCount(user.id);

            return res.json({
                success: true,
                unread_count: count
            });
        } catch (error) {
            console.error('Erro ao obter contagem de não lidas:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const notification = await Notification.findById(id);
            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificação não encontrada'
                });
            }

            // Check if notification belongs to user
            if (notification.user_id !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado'
                });
            }

            await notification.markAsRead();

            return res.json({
                success: true,
                message: 'Notificação marcada como lida'
            });
        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async markAllAsRead(req, res) {
        try {
            const user = req.user;

            await Notification.markAllAsRead(user.id);

            return res.json({
                success: true,
                message: 'Todas as notificações foram marcadas como lidas'
            });
        } catch (error) {
            console.error('Erro ao marcar todas como lidas:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = new NotificationController();