# Configuração Firebase Push Notifications

## 📱 Configuração Frontend (React Native)

### 1. Configurar Firebase no Console

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto ou use existente
3. Adicione um app Android e iOS ao projeto

### 2. Configurar Android

1. Baixe o arquivo `google-services.json`
2. Coloque em `cotaja/android/app/google-services.json`
3. Adicione ao `android/build.gradle`:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

4. Adicione ao `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

### 3. Configurar iOS

1. Baixe o arquivo `GoogleService-Info.plist`
2. Adicione ao projeto iOS via Xcode
3. Configure capabilities para Push Notifications

### 4. Configurar React Native

Adicione ao `index.js`:
```javascript
import messaging from '@react-native-firebase/messaging';

// Background message handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
});
```

## 🔧 Configuração Backend (Laravel)

### 1. Obter Service Account Key

1. No Firebase Console, vá para **Project Settings**
2. Aba **Service Accounts**
3. Clique em **Generate new private key**
4. Baixe o arquivo JSON

### 2. Configurar Laravel

1. Crie o diretório: `storage/app/firebase/`
2. Coloque o arquivo JSON em: `storage/app/firebase/service-account.json`
3. Adicione ao `.env`:

```env
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_CREDENTIALS=storage/app/firebase/service-account.json
```

### 3. Dar Permissões ao Arquivo

```bash
chmod 600 storage/app/firebase/service-account.json
```

## 🧪 Testar Notificações

### Teste Manual via Postman

1. **Salvar Token FCM:**
```http
POST /api/fcm-token
Authorization: Bearer {token}
Content-Type: application/json

{
  "fcm_token": "seu-token-fcm-aqui"
}
```

2. **Criar Demanda (dispara notificação):**
```http
POST /api/orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Limpeza Residencial",
  "description": "Preciso de limpeza completa",
  "category": "limpeza",
  "budget": 200,
  "deadline": 7,
  "address": "Rua Teste, 123"
}
```

### Logs para Debug

Verifique os logs em:
- `storage/logs/laravel.log`
- Console do React Native

## 🔍 Troubleshooting

### Problemas Comuns

1. **Token FCM não é enviado:**
   - Verificar permissões de notificação
   - Verificar configuração do Firebase

2. **Backend não envia push:**
   - Verificar credenciais do Firebase
   - Verificar logs do Laravel

3. **Notificação não aparece:**
   - Verificar se o app está em background
   - Verificar configurações do dispositivo

### Debug Útil

```bash
# Ver logs do Laravel
tail -f storage/logs/laravel.log

# Testar Firebase no terminal (opcional)
php artisan tinker
>>> $user = App\Models\User::find(1);
>>> $service = new App\Services\NotificationService();
>>> // Testar método diretamente
```

## 📝 Notas Importantes

- As notificações só funcionam em dispositivos reais (não simuladores)
- Para iOS, é necessário certificado APNs configurado no Firebase
- Para Android, as notificações funcionam automaticamente
- Tokens FCM podem expirar e precisam ser renovados

## 🚀 Próximos Passos

1. Configurar Firebase conforme instruções acima
2. Testar em dispositivos reais
3. Implementar deep linking para navegação via notificações
4. Configurar ícones e sons personalizados
