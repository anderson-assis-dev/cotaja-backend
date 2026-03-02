const { sendPushNotification, sendBulkNotifications, pushService } = require('../middlewares/pushNotification');

class PushNotificationController {
    
    async send(req, res) {
        try {
            const { registration_id, device, title, message, sound, image_url, production } = req.body;

            if (!registration_id || !device || !title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: registration_id, device, title, message'
                });
            }

            const result = await sendPushNotification({
                registration_id,
                device,
                title,
                message,
                sound,
                image_url,
                production: production || false
            });

            return res.json({
                success: true,
                message: 'Notification sent successfully',
                data: result
            });

        } catch (error) {
            console.error('Error sending push notification:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to send notification',
                error: error.message
            });
        }
    }

    
    async sendBulk(req, res) {
        try {
            const { devices, title, message, sound, image_url } = req.body;

            if (!devices || !Array.isArray(devices) || !title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: devices (array), title, message'
                });
            }

            const results = await sendBulkNotifications(devices, title, message, {
                sound,
                image_url
            });

            const successCount = results.filter(r => r.success).length;
            const totalCount = results.length;

            return res.json({
                success: true,
                message: `Sent ${successCount}/${totalCount} notifications successfully`,
                data: {
                    total: totalCount,
                    successful: successCount,
                    failed: totalCount - successCount,
                    results: results
                }
            });

        } catch (error) {
            console.error('Error sending bulk notifications:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to send bulk notifications',
                error: error.message
            });
        }
    }

    
    async sendToUser(req, res) {
        try {
            const { user_id, title, message, sound, image_url } = req.body;

            if (!user_id || !title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: user_id, title, message'
                });
            }

            const result = await pushService.sendToUser(user_id, title, message, {
                sound,
                image_url
            });

            return res.json({
                success: true,
                message: 'Notification sent to user successfully',
                data: result
            });

        } catch (error) {
            console.error('Error sending notification to user:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to send notification to user',
                error: error.message
            });
        }
    }

    
    async test(req, res) {
        try {
            const { registration_id, device } = req.body;

            if (!registration_id || !device) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: registration_id, device'
                });
            }

            const result = await sendPushNotification({
                registration_id,
                device,
                title: 'Test Notification',
                message: 'This is a test notification from Cotaja API',
                sound: 'default'
            });

            return res.json({
                success: true,
                message: 'Test notification sent successfully',
                data: result
            });

        } catch (error) {
            console.error('Error sending test notification:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to send test notification',
                error: error.message
            });
        }
    }

    
    async status(req, res) {
        try {
            const status = {
                service: 'PushNotificationService',
                status: 'active',
                firebase_configured: !!process.env.FIREBASE_CLIENT_EMAIL && !!process.env.FIREBASE_PRIVATE_KEY,
                ios_configured: !!process.env.IOS_PEM_CERT_PATH && !!process.env.IOS_APP_BUNDLE,
                timestamp: new Date().toISOString()
            };

            return res.json({
                success: true,
                data: status
            });

        } catch (error) {
            console.error('Error getting push notification status:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get service status',
                error: error.message
            });
        }
    }
}

module.exports = new PushNotificationController();