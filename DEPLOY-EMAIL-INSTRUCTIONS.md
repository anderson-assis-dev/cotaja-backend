# 📧 Instruções para Deploy das Configurações de Email

## 🔍 Problema Identificado
O email não está sendo enviado porque o arquivo `.env` no servidor precisa ser atualizado com as novas credenciais do Gmail.

## ✅ Passos para Resolver

### 1️⃣ Enviar arquivo .env atualizado para o servidor
```bash
cd /Volumes/Kingston-SSD/Cotaja
scp -i ~/.ssh/ssh-key-2025-10-03-cotaja.key cotaja-nodejs/.env ubuntu@164.152.40.94:~/cotaja-nodejs/
```

### 2️⃣ Enviar script de teste de email
```bash
scp -i ~/.ssh/ssh-key-2025-10-03-cotaja.key cotaja-nodejs/test-email.js ubuntu@164.152.40.94:~/cotaja-nodejs/
```

### 3️⃣ Conectar ao servidor
```bash
ssh -i ~/.ssh/ssh-key-2025-10-03-cotaja.key ubuntu@164.152.40.94
```

### 4️⃣ No servidor, verificar se o .env foi atualizado
```bash
cd ~/cotaja-nodejs
cat .env | grep MAIL
```

Você deve ver:
```
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=no-reply@cotaja.io
MAIL_PASSWORD=qyrx sgrw uvtn kxzh
MAIL_FROM_ADDRESS=no-reply@cotaja.io
MAIL_FROM_NAME=Cotaja
```

### 5️⃣ Testar o envio de email
```bash
node test-email.js
```

**ANTES DE EXECUTAR:** Edite o arquivo `test-email.js` e altere o email de destino na linha:
```javascript
to: 'teste@exemplo.com', // ALTERE PARA SEU EMAIL DE TESTE
```

Para seu email real:
```bash
nano test-email.js
# Encontre a linha "to: 'teste@exemplo.com'"
# Altere para seu email
# Ctrl+X para sair, Y para salvar
```

### 6️⃣ Reiniciar o servidor Node.js
Após confirmar que o teste funciona, reinicie o servidor:

**Se estiver usando PM2:**
```bash
pm2 restart cotaja-nodejs
# ou
pm2 restart all
```

**Se estiver rodando manualmente:**
```bash
# Pare o processo atual (Ctrl+C no terminal onde está rodando)
# Depois inicie novamente:
cd ~/cotaja-nodejs
node src/server.js
# ou
npm start
```

**Se estiver usando systemd:**
```bash
sudo systemctl restart cotaja-nodejs
```

### 7️⃣ Verificar os logs
```bash
# Se usar PM2:
pm2 logs cotaja-nodejs

# Se usar systemd:
sudo journalctl -u cotaja-nodejs -f

# Ou veja os logs diretos do console
```

### 8️⃣ Testar registro de usuário
Agora faça um teste de registro de usuário pela aplicação e verifique:
1. Se o console mostra "📧 Enviando email de boas-vindas para:"
2. Se aparece "✅ Email de boas-vindas enviado com sucesso"
3. Se o email chega na caixa de entrada

## 🔧 Troubleshooting

### Se o teste falhar com erro de autenticação:
- Verifique se a senha `qyrx sgrw uvtn kxzh` é uma App Password válida
- No Gmail, vá em: Configurações → Segurança → Verificação em duas etapas → Senhas de app
- Gere uma nova App Password se necessário

### Se o teste falhar com erro de conexão:
- Verifique se o servidor tem acesso à internet
- Teste: `ping smtp.gmail.com`
- Teste: `telnet smtp.gmail.com 587`

### Se o email não chegar:
- Verifique a pasta de spam
- Verifique os logs do Gmail no console de administração
- Confirme que o domínio `cotaja.io` está verificado no Gmail

## 📝 Notas Importantes

⚠️ **SEGURANÇA:** O arquivo `.env` contém credenciais sensíveis. Certifique-se de que:
- O arquivo tem permissões 600: `chmod 600 .env`
- Não está sendo versionado no git (deve estar no `.gitignore`)

✅ **Arquivos atualizados:**
- `src/controllers/AuthController.js` - Método sendWelcomeEmail melhorado
- `.env` - Credenciais do Gmail configuradas
- `test-email.js` - Script de teste criado
