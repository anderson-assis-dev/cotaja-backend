require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log('🔍 Verificando configurações de email...');
    console.log('MAIL_HOST:', process.env.MAIL_HOST);
    console.log('MAIL_PORT:', process.env.MAIL_PORT);
    console.log('MAIL_USERNAME:', process.env.MAIL_USERNAME);
    console.log('MAIL_PASSWORD:', process.env.MAIL_PASSWORD ? '***' + process.env.MAIL_PASSWORD.slice(-4) : 'NÃO CONFIGURADA');
    console.log('MAIL_FROM_ADDRESS:', process.env.MAIL_FROM_ADDRESS);
    console.log('MAIL_FROM_NAME:', process.env.MAIL_FROM_NAME);
    console.log('');

    try {
        console.log('📧 Criando transporter...');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT,
            secure: false,
            auth: {
                user: process.env.MAIL_USERNAME,
                pass: process.env.MAIL_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        console.log('✅ Transporter criado com sucesso');
        console.log('');

        console.log('📨 Verificando conexão com servidor SMTP...');
        await transporter.verify();
        console.log('✅ Conexão verificada com sucesso!');
        console.log('');

        console.log('📧 Enviando email de teste...');
        const info = await transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
            to: 'anderson.asnascimentto@gmail.com',
            subject: 'Teste de Email - Cotaja',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #2563eb;">Teste de Email - Cotaja</h1>
                    <p>Este é um email de teste do sistema Cotaja.</p>
                    <p>Se você recebeu este email, significa que o sistema de envio está funcionando corretamente!</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">
                        Enviado em: ${new Date().toLocaleString('pt-BR')}
                    </p>
                </div>
            `
        });

        console.log('✅ Email enviado com sucesso!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        console.log('');
        console.log('🎉 Teste concluído com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao testar email:');
        console.error('Tipo:', error.name);
        console.error('Mensagem:', error.message);
        console.error('');

        if (error.code) {
            console.error('Código:', error.code);
        }

        if (error.command) {
            console.error('Comando:', error.command);
        }

        console.error('');
        console.error('Stack completo:');
        console.error(error.stack);

        console.log('');
        console.log('💡 Possíveis soluções:');
        console.log('1. Verifique se as credenciais do Gmail estão corretas no .env');
        console.log('2. Certifique-se de usar uma App Password, não a senha regular');
        console.log('3. Verifique se a autenticação de 2 fatores está ativada no Gmail');
        console.log('4. Confirme que o acesso a apps menos seguros está permitido');
    }
}

testEmail();
