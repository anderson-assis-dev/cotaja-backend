const PushNotificationService = require('../services/PushNotificationService');

const pushService = new PushNotificationService();

const pushNotificationMiddleware = (req, res, next) => {
    req.pushNotification = {
        
        send: async (data) => {
            return await pushService.sendAlert(data);
        },

        
        sendBulk: async (devices, title, message, options = {}) => {
            return await pushService.sendBulkNotifications(devices, title, message, options);
        },

        
        sendToUser: async (userId, title, message, options = {}) => {
            return await pushService.sendToUser(userId, title, message, options);
        },

        
        sendAndroid: async (token, title, message, imageUrl = null) => {
            return await pushService.sendAndroid(token, title, message, imageUrl);
        },

        
        sendIOS: async (token, title, message, sound = 'default', imageUrl = null) => {
            return await pushService.sendIOS(token, title, message, sound, imageUrl);
        }
    };

    next();
};

const sendPushNotification = async (data) => {
    return await pushService.sendAlert(data);
};

const sendBulkNotifications = async (devices, title, message, options = {}) => {
    return await pushService.sendBulkNotifications(devices, title, message, options);
};

module.exports = {
    pushNotificationMiddleware,
    sendPushNotification,
    sendBulkNotifications,
    pushService
};