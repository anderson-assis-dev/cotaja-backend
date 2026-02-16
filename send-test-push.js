/**
 * Script para enviar push notification de teste para um usuário específico
 * Uso: node send-test-push.js
 */

require('dotenv').config();
const PushNotificationService = require('./src/services/PushNotificationService');
const { pool } = require('./src/config/database');

async function sendTestPush() {
  const connection = await pool.getConnection();
  const pushService = new PushNotificationService();

  try {
    console.log('🔍 Buscando usuário piroposantosdev@gmail.com...\n');

    // Buscar usuário pelo email
    const [rows] = await connection.execute(
      'SELECT id, name, email, fcm_token, device_platform FROM users WHERE email = ?',
      ['piroposantosdev@gmail.com']
    );

    if (rows.length === 0) {
      console.log('❌ Usuário não encontrado');
      process.exit(1);
    }

    const user = rows[0];
    console.log('✅ Usuário encontrado:');
    console.log('   ID:', user.id);
    console.log('   Nome:', user.name);
    console.log('   Email:', user.email);
    console.log('   Platform:', user.device_platform || 'Não definido');
    console.log('   FCM Token:', user.fcm_token ? (user.fcm_token.substring(0, 30) + '...') : 'Não cadastrado');
    console.log('');

    if (!user.fcm_token) {
      console.log('❌ Usuário não possui FCM token cadastrado.');
      console.log('💡 Faça login no app para registrar o token de push notification.');
      process.exit(1);
    }

    // Enviar push notification
    console.log('🚀 Enviando push notification...\n');
    const result = await pushService.sendAlert({
      registration_id: user.fcm_token,
      device: user.device_platform || 'android',
      title: '🎉 Teste de Notificação Cotaja',
      message: `Olá ${user.name}! Esta é uma notificação de teste enviada às ${new Date().toLocaleTimeString('pt-BR')}.`,
      sound: 'default',
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
        user_id: user.id
      }
    });

    console.log('✅ Push notification enviada com sucesso!\n');
    console.log('📱 Resultado:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n💡 Verifique o dispositivo do usuário para confirmar o recebimento.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao enviar push notification:');
    console.error('   Mensagem:', error.message);
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

sendTestPush();
