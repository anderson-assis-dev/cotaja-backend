const { pool } = require('../config/database');
const User = require('../models/User');
const PushNotificationService = require('./PushNotificationService');
const emailService = require('./EmailService');
const moment = require('moment');

class ScheduleReminderService {
    constructor() {
        this.intervalId = null;
    }

    start() {
        console.log('⏰ Schedule reminder service started (checking every 5 min)');
        this.intervalId = setInterval(() => this.checkReminders(), 5 * 60 * 1000);
        this.checkReminders();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async checkReminders() {
        const connection = await pool.getConnection();
        try {
            const now = moment();

            const [dayReminders] = await connection.execute(
                `SELECT * FROM orders
                 WHERE status = 'in_progress'
                 AND scheduled_date IS NOT NULL
                 AND schedule_confirmed_by_client = 1
                 AND schedule_confirmed_by_provider = 1
                 AND schedule_reminder_1d_sent = 0
                 AND scheduled_date BETWEEN ? AND ?`,
                [
                    now.clone().add(23, 'hours').format('YYYY-MM-DD HH:mm:ss'),
                    now.clone().add(25, 'hours').format('YYYY-MM-DD HH:mm:ss')
                ]
            );

            for (const order of dayReminders) {
                await this.sendReminder(order, '1d', connection);
            }

            const [hourReminders] = await connection.execute(
                `SELECT * FROM orders
                 WHERE status = 'in_progress'
                 AND scheduled_date IS NOT NULL
                 AND schedule_confirmed_by_client = 1
                 AND schedule_confirmed_by_provider = 1
                 AND schedule_reminder_1h_sent = 0
                 AND scheduled_date BETWEEN ? AND ?`,
                [
                    now.clone().add(55, 'minutes').format('YYYY-MM-DD HH:mm:ss'),
                    now.clone().add(65, 'minutes').format('YYYY-MM-DD HH:mm:ss')
                ]
            );

            for (const order of hourReminders) {
                await this.sendReminder(order, '1h', connection);
            }

        } catch (error) {
            console.error('Erro ao verificar lembretes:', error);
        } finally {
            connection.release();
        }
    }

    async sendReminder(order, type, connection) {
        try {
            const formattedDate = moment(order.scheduled_date).format('DD/MM/YYYY [às] HH:mm');
            const timeLabel = type === '1d' ? 'amanhã' : 'em 1 hora';

            const client = await User.findById(order.client_id);
            const provider = await User.findById(order.provider_id);

            const recipients = [client, provider].filter(u => u);

            for (const user of recipients) {
                try {
                    if (user.fcm_token) {
                        const pushSvc = new PushNotificationService();
                        await pushSvc.sendAlert({
                            registration_id: user.fcm_token,
                            device: user.device_platform || 'ios',
                            title: `Lembrete de Serviço`,
                            message: `O serviço "${order.title}" está agendado para ${timeLabel} (${formattedDate})`,
                            sound: 'default',
                            data: {
                                type: 'schedule_reminder',
                                order_id: String(order.id),
                            },
                        });
                    }
                } catch (pushError) {
                    console.error(`Erro ao enviar push de lembrete (${type}):`, pushError.message);
                }

                try {
                    await emailService.sendScheduleReminderNotification(order, user, formattedDate, type);
                } catch (emailError) {
                    console.error(`Erro ao enviar email de lembrete (${type}):`, emailError.message);
                }
            }

            const field = type === '1d' ? 'schedule_reminder_1d_sent' : 'schedule_reminder_1h_sent';
            await connection.execute(
                `UPDATE orders SET ${field} = 1 WHERE id = ?`,
                [order.id]
            );

            console.log(`✅ Lembrete ${type} enviado para pedido #${order.id} - "${order.title}"`);
        } catch (error) {
            console.error(`Erro ao enviar lembrete ${type} para pedido #${order.id}:`, error);
        }
    }
}

module.exports = new ScheduleReminderService();
