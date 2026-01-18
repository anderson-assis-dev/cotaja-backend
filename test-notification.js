require('dotenv').config();
const { pool } = require('./src/config/database');
const { pushService } = require('./src/middlewares/pushNotification');

async function sendTestNotification() {
    try {
        console.log('🔍 Buscando usuário com ID 1...');

        // Buscar usuário com ID 1
        const [users] = await pool.query(
            'SELECT id, name, email, fcm_token, device_platform FROM users WHERE id = ?',
            [1]
        );

        if (users.length === 0) {
            console.log('❌ Usuário com ID 1 não encontrado');
            process.exit(1);
        }

        const user = users[0];
        console.log('✅ Usuário encontrado:', {
            id: user.id,
            name: user.name,
            email: user.email,
            device_platform: user.device_platform,
            has_token: !!user.fcm_token
        });

        if (!user.fcm_token) {
            console.log('❌ Usuário não possui fcm_token registrado');
            process.exit(1);
        }

        console.log('\n📤 Enviando notificação de teste via SANDBOX...');

        // Enviar notificação
        const result = await pushService.sendAlert({
            registration_id: user.fcm_token,
            device: user.device_platform || 'android',
            title: 'Notificação de Teste',
            message: `Olá ${user.name}! Esta é uma notificação de teste do servidor Cotaja.`,
            sound: 'default',
            production: false // Usar certificado Sandbox
        });

        console.log('✅ Notificação enviada com sucesso!');
        console.log('Resultado:', result);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao enviar notificação:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

sendTestNotification();
