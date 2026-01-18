/**
 * Script de teste para notificações de providers
 *
 * Este script testa se a notificação é enviada para todos os providers
 * quando um cliente cria um novo serviço
 */

require('dotenv').config();
const User = require('./src/models/User');
const { sendPushNotification } = require('./src/middlewares/pushNotification');

async function testProviderNotifications() {
    try {
        console.log('🧪 Testando notificações para providers...\n');

        // 1. Buscar todos os providers com tokens
        console.log('📋 Buscando providers com FCM tokens...');
        const providers = await User.getProviderTokens();

        if (providers.length === 0) {
            console.log('❌ Nenhum provider encontrado com FCM token!');
            console.log('\n💡 Certifique-se de que existem usuários com:');
            console.log('   - profile_type = "provider"');
            console.log('   - fcm_token não vazio');
            console.log('   - device_platform = "ios" ou "android"\n');
            return;
        }

        console.log(`✅ Encontrados ${providers.length} providers:\n`);
        providers.forEach((p, index) => {
            console.log(`   ${index + 1}. ${p.name} (${p.email})`);
            console.log(`      Platform: ${p.platform}`);
            console.log(`      Token: ${p.token.substring(0, 30)}...\n`);
        });

        // 2. Simular criação de serviço e enviar notificações
        const mockService = {
            title: 'Limpeza de piscina',
            description: 'Preciso de limpeza completa da piscina',
            category: 'limpeza',
            price: 150
        };

        const clientName = 'João Silva';

        console.log('📤 Enviando notificações de teste...\n');

        const notificationPromises = providers.map(provider => {
            console.log(`   📱 Enviando para ${provider.name}...`);

            return sendPushNotification({
                registration_id: provider.token,
                device: provider.platform,
                title: '🔔 Novo Pedido de Serviço!',
                message: `${clientName} solicitou: ${mockService.title}`,
                sound: 'default',
                production: false // Sandbox para teste
            }).catch(error => {
                console.error(`      ❌ Erro ao enviar para ${provider.name}: ${error.message}`);
                return { success: false, provider_id: provider.id, error: error.message };
            });
        });

        const results = await Promise.all(notificationPromises);

        // 3. Mostrar resultados
        console.log('\n📊 Resultados:');
        const successCount = results.filter(r => r && r.success).length;
        const failCount = results.length - successCount;

        console.log(`   ✅ Enviadas com sucesso: ${successCount}`);
        console.log(`   ❌ Falhas: ${failCount}`);

        if (failCount > 0) {
            console.log('\n❌ Detalhes das falhas:');
            results.forEach((result, index) => {
                if (!result || !result.success) {
                    console.log(`   - ${providers[index].name}: ${result?.error || 'Unknown error'}`);
                }
            });
        }

        console.log('\n✅ Teste concluído!\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro durante o teste:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Executar teste
testProviderNotifications();
