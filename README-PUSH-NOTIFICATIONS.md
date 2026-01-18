# Push Notifications Service - Cotaja

Este serviço de push notifications foi desenvolvido para o projeto Cotaja, seguindo a mesma lógica do código PHP original, mas implementado em Node.js.

## 📋 Funcionalidades

- ✅ Notificações push para Android via Firebase Cloud Messaging (FCM)
- ✅ Notificações push para iOS via Apple Push Notification Service (APNs)
- ✅ Envio de notificações individuais
- ✅ Envio em massa para múltiplos dispositivos
- ✅ Suporte a imagens nas notificações
- ✅ Autenticação JWT automática para Firebase
- ✅ Cache de tokens de acesso
- ✅ Middleware para fácil integração
- ✅ API REST para gerenciamento de notificações

## 🚀 Configuração

### 1. Instalar Dependências

```bash
npm install jsonwebtoken
```

### 2. Configurar Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env`:

```env
# Firebase Configuration (Android)
FIREBASE_PROJECT_ID=cotaja
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@cotaja.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----\n"

# iOS Configuration
IOS_PEM_CERT_PATH=./certificates/ios-push.pem
IOS_APP_BUNDLE=com.cotaja.app
```

### 3. Certificados iOS

1. Coloque seu certificado `.pem` no diretório `certificates/`
2. Certifique-se de que o arquivo contém tanto o certificado quanto a chave privada

### 4. Firebase Setup

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Vá em "Configurações do Projeto" > "Contas de Serviço"
3. Gere uma nova chave privada
4. Use os dados da chave para configurar as variáveis de ambiente

## 📡 API Endpoints

### Enviar Notificação Individual

```http
POST /api/notifications/push/send
Authorization: Bearer TOKEN

{
  "registration_id": "DEVICE_TOKEN",
  "device": "android|ios",
  "title": "Título da Notificação",
  "message": "Mensagem da notificação",
  "sound": "default",
  "image_url": "https://exemplo.com/imagem.jpg"
}
```

### Enviar Notificações em Massa

```http
POST /api/notifications/push/bulk
Authorization: Bearer TOKEN

{
  "devices": [
    {"id": 1, "token": "TOKEN_1", "platform": "android"},
    {"id": 2, "token": "TOKEN_2", "platform": "ios"}
  ],
  "title": "Título",
  "message": "Mensagem",
  "sound": "default",
  "image_url": "https://exemplo.com/imagem.jpg"
}
```

### Enviar para Usuário Específico

```http
POST /api/notifications/push/user
Authorization: Bearer TOKEN

{
  "user_id": 123,
  "title": "Título",
  "message": "Mensagem",
  "sound": "default",
  "image_url": "https://exemplo.com/imagem.jpg"
}
```

### Teste de Notificação

```http
POST /api/notifications/push/test
Authorization: Bearer TOKEN

{
  "registration_id": "DEVICE_TOKEN",
  "device": "android|ios"
}
```

### Status do Serviço

```http
GET /api/notifications/push/status
Authorization: Bearer TOKEN
```

## 💻 Uso Programático

### Import do Serviço

```javascript
const { sendPushNotification, sendBulkNotifications } = require('./src/middlewares/pushNotification');
```

### Enviar Notificação Individual

```javascript
const result = await sendPushNotification({
  registration_id: 'DEVICE_TOKEN',
  device: 'android', // ou 'ios'
  title: 'Nova Proposta',
  message: 'Você recebeu uma nova proposta!',
  sound: 'default',
  image_url: 'https://exemplo.com/imagem.jpg'
});
```

### Enviar Notificações em Massa

```javascript
const devices = [
  { id: 1, token: 'TOKEN_1', platform: 'android' },
  { id: 2, token: 'TOKEN_2', platform: 'ios' }
];

const results = await sendBulkNotifications(
  devices,
  'Título da Notificação',
  'Mensagem da notificação',
  {
    sound: 'default',
    image_url: 'https://exemplo.com/imagem.jpg'
  }
);
```

### Usando o Middleware

```javascript
// No app.js
const { pushNotificationMiddleware } = require('./src/middlewares/pushNotification');
app.use(pushNotificationMiddleware);

// Em qualquer rota
app.post('/exemplo', async (req, res) => {
  const result = await req.pushNotification.send({
    registration_id: req.body.token,
    device: req.body.platform,
    title: 'Bem-vindo!',
    message: 'Obrigado por se cadastrar!'
  });

  res.json({ success: true, result });
});
```

## 🔧 Integração com o Sistema

### Exemplo: Notificar sobre Nova Demanda

```javascript
// No OrderController.js
const { sendBulkNotifications } = require('../middlewares/pushNotification');

async function notifyProvidersAboutNewOrder(order) {
  // Buscar prestadores da categoria
  const providers = await User.findProvidersByCategory(order.category);

  const devices = providers.map(provider => ({
    id: provider.id,
    token: provider.device_token,
    platform: provider.device_platform
  }));

  return await sendBulkNotifications(
    devices,
    'Nova Demanda Disponível',
    `Nova demanda na categoria ${order.category}: ${order.title}`,
    {
      sound: 'notification.wav'
    }
  );
}
```

### Exemplo: Notificar Cliente sobre Proposta

```javascript
async function notifyClientAboutProposal(proposal) {
  const client = await User.findById(proposal.client_id);

  return await sendPushNotification({
    registration_id: client.device_token,
    device: client.device_platform,
    title: 'Nova Proposta Recebida',
    message: `Proposta de R$ ${proposal.price} para "${proposal.order_title}"`,
    sound: 'proposal.wav'
  });
}
```

## 🛠️ Estrutura dos Arquivos

```
src/
├── services/
│   └── PushNotificationService.js      # Serviço principal
├── middlewares/
│   └── pushNotification.js             # Middleware para integração
├── controllers/
│   └── PushNotificationController.js   # Controller da API
└── routes/
    └── notifications.js                 # Rotas da API

examples/
└── push-notification-usage.js          # Exemplos de uso

certificates/
└── ios-push.pem                        # Certificado iOS (não incluído no git)
```

## 🔒 Segurança

- ✅ Todas as rotas requerem autenticação JWT
- ✅ Validação de parâmetros obrigatórios
- ✅ Chaves privadas armazenadas em variáveis de ambiente
- ✅ Certificados iOS não versionados no git

## 📝 Logs

O serviço gera logs detalhados para:
- ✅ Notificações enviadas com sucesso
- ✅ Erros de envio
- ✅ Problemas de autenticação
- ✅ Certificados inválidos

## 🐛 Troubleshooting

### Android não recebe notificações
- Verifique as credenciais do Firebase
- Confirme se o token do dispositivo está válido
- Verifique se o projeto Firebase está configurado corretamente

### iOS não recebe notificações
- Verifique se o certificado `.pem` está válido
- Confirme o bundle identifier da app
- Teste com o ambiente de desenvolvimento vs produção

### Erro de autenticação Firebase
- Verifique se a chave privada está formatada corretamente
- Confirme se o client_email está correto
- Verifique se o projeto_id corresponde ao Firebase

## 📞 Suporte

Para dúvidas ou problemas, consulte os logs do serviço ou verifique a configuração das variáveis de ambiente.