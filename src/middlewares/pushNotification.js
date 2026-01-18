const PushNotificationService = require('../services/PushNotificationService');

// Create singleton instance
const pushService = new PushNotificationService();

/**
 * Middleware to add push notification functionality to req object
 */
const pushNotificationMiddleware = (req, res, next) => {
    // Add push notification methods to request object
    req.pushNotification = {
        /**
         * Send a push notification
         */
        send: async (data) => {
            return await pushService.sendAlert(data);
        },

        /**
         * Send to multiple devices
         */
        sendBulk: async (devices, title, message, options = {}) => {
            return await pushService.sendBulkNotifications(devices, title, message, options);
        },

        /**
         * Send to specific user
         */
        sendToUser: async (userId, title, message, options = {}) => {
            return await pushService.sendToUser(userId, title, message, options);
        },

        /**
         * Send Android notification
         */
        sendAndroid: async (token, title, message, imageUrl = null) => {
            return await pushService.sendAndroid(token, title, message, imageUrl);
        },

        /**
         * Send iOS notification
         */
        sendIOS: async (token, title, message, sound = 'default', imageUrl = null) => {
            return await pushService.sendIOS(token, title, message, sound, imageUrl);
        }
    };

    next();
};

/**
 * Helper function to send notification without middleware
 */
const sendPushNotification = async (data) => {
    return await pushService.sendAlert(data);
};

/**
 * Helper function to send bulk notifications
 */
const sendBulkNotifications = async (devices, title, message, options = {}) => {
    return await pushService.sendBulkNotifications(devices, title, message, options);
};

module.exports = {
    pushNotificationMiddleware,
    sendPushNotification,
    sendBulkNotifications,
    pushService
};