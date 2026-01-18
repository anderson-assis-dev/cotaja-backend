// Examples of how to use the Push Notification Service

const { sendPushNotification, sendBulkNotifications } = require('../src/middlewares/pushNotification');

// Example 1: Send single Android notification
async function sendAndroidNotification() {
    try {
        const result = await sendPushNotification({
            registration_id: 'ANDROID_DEVICE_TOKEN_HERE',
            device: 'android',
            title: 'Nova Proposta Recebida',
            message: 'Você recebeu uma nova proposta para seu pedido!',
            image_url: 'https://example.com/image.jpg'
        });

        console.log('Android notification sent:', result);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Example 2: Send single iOS notification
async function sendIOSNotification() {
    try {
        const result = await sendPushNotification({
            registration_id: 'IOS_DEVICE_TOKEN_HERE',
            device: 'ios',
            title: 'Pedido Aceito',
            message: 'Seu pedido foi aceito pelo prestador!',
            sound: 'notification.wav'
        });

        console.log('iOS notification sent:', result);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Example 3: Send bulk notifications
async function sendBulkNotifications() {
    try {
        const devices = [
            { id: 1, token: 'ANDROID_TOKEN_1', platform: 'android' },
            { id: 2, token: 'IOS_TOKEN_1', platform: 'ios' },
            { id: 3, token: 'ANDROID_TOKEN_2', platform: 'android' }
        ];

        const results = await sendBulkNotifications(
            devices,
            'Nova Atualização',
            'Uma nova versão do app está disponível!',
            {
                sound: 'default',
                image_url: 'https://example.com/update.jpg'
            }
        );

        console.log('Bulk notifications sent:', results);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Example 4: Using in a route handler
function exampleRouteHandler(req, res) {
    // Using the middleware (if added to app)
    req.pushNotification.send({
        registration_id: req.body.device_token,
        device: req.body.platform,
        title: 'Welcome!',
        message: 'Thanks for joining Cotaja!'
    }).then(result => {
        res.json({ success: true, result });
    }).catch(error => {
        res.status(500).json({ success: false, error: error.message });
    });
}

// Example 5: Integration with Order creation
async function notifyProvidersAboutNewOrder(order) {
    try {
        // This would typically get provider tokens from database
        const providers = [
            { token: 'PROVIDER_1_TOKEN', platform: 'android' },
            { token: 'PROVIDER_2_TOKEN', platform: 'ios' }
        ];

        const results = await sendBulkNotifications(
            providers,
            'Nova Demanda Disponível',
            `Nova demanda na categoria ${order.category}: ${order.title}`,
            {
                sound: 'notification.wav',
                image_url: order.image_url
            }
        );

        console.log(`Notified ${results.filter(r => r.success).length} providers`);
        return results;
    } catch (error) {
        console.error('Error notifying providers:', error);
        throw error;
    }
}

// Example 6: Notify client about proposal
async function notifyClientAboutProposal(proposal, clientToken, clientPlatform) {
    try {
        const result = await sendPushNotification({
            registration_id: clientToken,
            device: clientPlatform,
            title: 'Nova Proposta Recebida',
            message: `Você recebeu uma nova proposta de R$ ${proposal.price} para seu pedido "${proposal.order_title}"`,
            sound: 'proposal.wav'
        });

        console.log('Client notified about proposal:', result);
        return result;
    } catch (error) {
        console.error('Error notifying client:', error);
        throw error;
    }
}

module.exports = {
    sendAndroidNotification,
    sendIOSNotification,
    sendBulkNotifications,
    exampleRouteHandler,
    notifyProvidersAboutNewOrder,
    notifyClientAboutProposal
};