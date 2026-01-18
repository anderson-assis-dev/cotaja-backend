# Cotaja API - Node.js Version

🚀 **Cotaja API convertida de Laravel (PHP) para Node.js + Express + MySQL2**

Este projeto é uma conversão completa da API Cotaja originalmente desenvolvida em Laravel para Node.js, mantendo **exatamente a mesma funcionalidade e lógica de negócio**.

## 📋 Características

- ✅ **Conversão completa** do Laravel para Node.js
- ✅ **Mesma estrutura de banco de dados** (MySQL)
- ✅ **Mesmas rotas e endpoints** da API original
- ✅ **Autenticação JWT** (substituindo Laravel Sanctum)
- ✅ **Validação de dados** com express-validator
- ✅ **Queries MySQL nativas** com mysql2 (sem ORM)
- ✅ **Sistema de notificações** mantido
- ✅ **Upload de arquivos** implementado
- ✅ **Envio de e-mails** com nodemailer

## 🛠️ Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **MySQL2** - Driver MySQL para consultas nativas
- **JWT** - Autenticação via tokens
- **Express-validator** - Validação de dados
- **Nodemailer** - Envio de e-mails
- **Multer/Express-fileupload** - Upload de arquivos
- **Moment.js** - Manipulação de datas
- **bcryptjs** - Hash de senhas

## 📁 Estrutura do Projeto

```
cotaja-nodejs/
├── src/
│   ├── config/
│   │   └── database.js          # Configuração do banco de dados
│   ├── controllers/
│   │   ├── AuthController.js    # Autenticação
│   │   ├── OrderController.js   # Pedidos
│   │   ├── ProposalController.js # Propostas
│   │   └── NotificationController.js # Notificações
│   ├── models/
│   │   ├── User.js             # Model de usuários
│   │   ├── Order.js            # Model de pedidos
│   │   ├── Proposal.js         # Model de propostas
│   │   └── Notification.js     # Model de notificações
│   ├── middlewares/
│   │   └── auth.js             # Middleware de autenticação
│   ├── routes/
│   │   ├── auth.js             # Rotas de autenticação
│   │   ├── orders.js           # Rotas de pedidos
│   │   ├── proposals.js        # Rotas de propostas
│   │   ├── notifications.js    # Rotas de notificações
│   │   └── index.js            # Agregador de rotas
│   ├── services/
│   │   └── NotificationService.js # Serviço de notificações
│   ├── utils/
│   │   ├── jwt.js              # Utilitários JWT
│   │   └── validation.js       # Validações
│   ├── app.js                  # Configuração do Express
│   └── server.js               # Servidor principal
├── database/
│   └── migrations/             # Migrações SQL
├── package.json
├── .env.example
└── README.md
```

## 🚀 Instalação e Configuração

### 1. Clone o repositório
```bash
git clone <repository-url>
cd cotaja-nodejs
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
APP_PORT=3000
APP_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=cotaja
DB_USERNAME=root
DB_PASSWORD=

JWT_SECRET=seu-jwt-secret-aqui
JWT_EXPIRES_IN=7d

MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@cotaja.com
MAIL_FROM_NAME=Cotaja

UPLOAD_PATH=uploads
MAX_FILE_SIZE=10485760

CORS_ORIGIN=*
```

### 4. Execute as migrações do banco de dados

Execute os arquivos SQL na pasta `database/migrations/` na ordem numérica:

```bash
mysql -u root -p cotaja < database/migrations/001_create_users_table.sql
mysql -u root -p cotaja < database/migrations/002_create_orders_table.sql
mysql -u root -p cotaja < database/migrations/003_create_proposals_table.sql
mysql -u root -p cotaja < database/migrations/004_create_attachments_table.sql
mysql -u root -p cotaja < database/migrations/005_create_notifications_table.sql
mysql -u root -p cotaja < database/migrations/006_create_cache_table.sql
mysql -u root -p cotaja < database/migrations/007_create_jobs_table.sql
```

### 5. Inicie a aplicação

Para desenvolvimento:
```bash
npm run dev
```

Para produção:
```bash
npm start
```

A API estará disponível em: `http://localhost:3000`

## 📡 Endpoints da API

### Autenticação
- `POST /api/auth/register` - Registrar usuário
- `POST /api/auth/login` - Fazer login
- `POST /api/auth/logout` - Fazer logout
- `GET /api/auth/me` - Obter dados do usuário
- `PUT /api/auth/profile` - Atualizar perfil
- `PUT /api/auth/profile-type` - Atualizar tipo de perfil
- `POST /api/auth/fcm-token` - Salvar token FCM

### Pedidos
- `GET /api/orders` - Listar pedidos
- `POST /api/orders` - Criar pedido
- `GET /api/orders/available` - Pedidos disponíveis
- `GET /api/orders/recent` - Pedidos recentes
- `GET /api/orders/stats` - Estatísticas
- `GET /api/orders/:id` - Obter pedido
- `PUT /api/orders/:id` - Atualizar pedido
- `DELETE /api/orders/:id` - Deletar pedido
- `POST /api/orders/:id/start-auction` - Iniciar leilão

### Propostas
- `GET /api/proposals` - Listar propostas
- `POST /api/proposals` - Criar proposta
- `GET /api/proposals/:id` - Obter proposta
- `PUT /api/proposals/:id` - Atualizar proposta
- `POST /api/proposals/:id/accept` - Aceitar proposta
- `POST /api/proposals/:id/reject` - Rejeitar proposta
- `POST /api/proposals/:id/withdraw` - Cancelar proposta

### Notificações
- `GET /api/notifications` - Listar notificações
- `GET /api/notifications/unread-count` - Contar não lidas
- `PUT /api/notifications/:id/read` - Marcar como lida
- `PUT /api/notifications/mark-all-read` - Marcar todas como lidas

### Rotas de Compatibilidade (Laravel)
Para manter compatibilidade com clientes existentes:
- `POST /register` - Alias para `/api/auth/register`
- `POST /login` - Alias para `/api/auth/login`
- `GET /user` - Alias para `/api/auth/me`

## 🔐 Autenticação

A API usa autenticação JWT. Inclua o token no header:

```
Authorization: Bearer <seu-jwt-token>
```

## 🗄️ Banco de Dados

O projeto usa **exatamente o mesmo schema** do Laravel original:

- **users** - Usuários (clientes e prestadores)
- **orders** - Pedidos
- **proposals** - Propostas
- **notifications** - Notificações
- **attachments** - Anexos
- **cache** - Cache do sistema
- **jobs** - Filas de trabalho

## ⚡ Diferenças do Laravel Original

### Mantido Igual:
- ✅ Todas as rotas e endpoints
- ✅ Estrutura do banco de dados
- ✅ Lógica de negócio
- ✅ Validações
- ✅ Queries SQL (convertidas para mysql2)
- ✅ Sistema de notificações
- ✅ Envio de e-mails

### Adaptado para Node.js:
- 🔄 **Laravel Sanctum** → **JWT**
- 🔄 **Eloquent ORM** → **MySQL2 queries nativas**
- 🔄 **Laravel Validation** → **Express-validator**
- 🔄 **Laravel Mail** → **Nodemailer**
- 🔄 **Laravel Storage** → **Express-fileupload**

## 🧪 Testes

Para testar a API:

```bash
# Teste de saúde
curl http://localhost:3000/api/health

# Registro de usuário
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"João","email":"joao@teste.com","phone":"11999999999","password":"123456","password_confirmation":"123456"}'
```

## 📝 Logs e Debug

Para desenvolvimento, configure:
```env
APP_ENV=development
```

Logs detalhados aparecerão no console.

## 🚢 Deploy

Para produção:

1. Configure as variáveis de ambiente
2. Execute as migrações
3. Configure um proxy reverso (nginx)
4. Use PM2 para gerenciar o processo:

```bash
npm install -g pm2
pm2 start src/server.js --name cotaja-api
pm2 startup
pm2 save
```

## 📞 Suporte

Para questões sobre a conversão ou funcionalidades, consulte o código original em Laravel como referência.

---

**⭐ Conversão completa e funcional do Laravel para Node.js mantendo 100% da funcionalidade original!**