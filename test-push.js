/**
 * Script de teste para Push Notifications
 *
 * Como usar:
 * 1. Substitua YOUR_DEVICE_TOKEN pelo token real do seu dispositivo iOS
 * 2. Execute: node test-push.js
 */

require('dotenv').config();
const PushNotificationService = require('./src/services/PushNotificationService');

const pushService = new PushNotificationService();

async function testPushNotification() {
    try {
        console.log('🧪 Iniciando teste de push notification...\n');

        // ⚠️ IMPORTANTE: Substitua pelo token real do seu dispositivo iOS
        const deviceToken = 'YOUR_DEVICE_TOKEN_HERE';

        if (deviceToken === 'YOUR_DEVICE_TOKEN_HERE') {
            console.error('❌ ERRO: Você precisa substituir YOUR_DEVICE_TOKEN_HERE pelo token real do seu dispositivo!');
            console.log('\n📱 Para obter o device token no React Native:');
            console.log('   - iOS: Use @react-native-firebase/messaging ou expo-notifications');
            console.log('   - O token aparece nos logs quando você solicita permissão de notificação\n');
            return;
        }

        // Configuração do teste
        const testData = {
            registration_id: deviceToken,
            device: 'ios',
            title: 'Teste Cotaja 🎉',
            message: 'Esta é uma notificação de teste do backend Node.js!',
            sound: 'default',
            production: false // Use false para sandbox, true para produção
        };

        console.log('📋 Configuração do teste:');
        console.log(`   Device: ${testData.device}`);
        console.log(`   Environment: ${testData.production ? 'PRODUCTION' : 'SANDBOX'}`);
        console.log(`   Title: ${testData.title}`);
        console.log(`   Message: ${testData.message}`);
        console.log(`   Token: ${deviceToken.substring(0, 20)}...`);
        console.log('\n🚀 Enviando notificação...\n');

        const result = await pushService.sendAlert(testData);

        console.log('\n✅ SUCESSO! Notificação enviada com sucesso!');
        console.log('📱 Verifique seu dispositivo iOS\n');
        console.log('Detalhes da resposta:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('\n❌ ERRO ao enviar notificação:');
        console.error(error.message);

        if (error.message.includes('certificate not found')) {
            console.log('\n💡 Dica: Verifique se os certificados estão no local correto:');
            console.log('   - ./certificates/APNs_Certificate.pem');
            console.log('   - ./certificates/APNs_PrivateKey.pem');
        } else if (error.message.includes('BadDeviceToken')) {
            console.log('\n💡 Dica: O device token pode estar incorreto ou expirado.');
            console.log('   Certifique-se de usar um token válido do dispositivo iOS.');
        } else if (error.message.includes('DeviceTokenNotForTopic')) {
            console.log('\n💡 Dica: Verifique se o Bundle ID está correto no .env:');
            console.log('   IOS_APP_BUNDLE=com.cotaja (ou seu bundle ID real)');
        }

        console.log('\n');
    }
}

// Executar teste
testPushNotification();
