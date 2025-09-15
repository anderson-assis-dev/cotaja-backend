#!/bin/bash

# Script de Configuração Pós-Deploy - Cotaja
# Servidor: 82.25.66.190

echo "🚀 Configurando Cotaja no servidor..."
echo "====================================="

# Verificar se estamos no diretório correto
if [ ! -f "artisan" ]; then
    echo "❌ Erro: Execute este script no diretório raiz do Laravel"
    exit 1
fi

echo "📁 Diretório atual: $(pwd)"

# 1. Configurar arquivo .env
echo "🔧 Configurando arquivo .env..."
if [ -f "env.server" ]; then
    cp env.server .env
    echo "✅ Arquivo .env configurado com dados do servidor"
else
    echo "⚠️ Arquivo env.server não encontrado. Configurando manualmente..."
    
    # Criar .env com dados corretos
    cat > .env << EOF
APP_NAME=Cotaja
APP_ENV=production
APP_KEY=base64:shJKcdDAdviWM6x1n9k08UQs0/UuJLm60lNR13PVm0E=
APP_DEBUG=false
APP_URL=https://srv1009490.hstgr.cloud

APP_LOCALE=pt_BR
APP_FALLBACK_LOCALE=pt_BR
APP_FAKER_LOCALE=pt_BR

APP_MAINTENANCE_DRIVER=file

PHP_CLI_SERVER_WORKERS=4

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

# Configuração do banco de dados MySQL
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=cotaja
DB_USERNAME=cotaja
DB_PASSWORD=A@ngela301165

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database

CACHE_STORE=database

MEMCACHED_HOST=127.0.0.1

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

# Configuração de email
MAIL_MAILER=smtp
MAIL_SCHEME=null
MAIL_HOST=localhost
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS="noreply@srv1009490.hstgr.cloud"
MAIL_FROM_NAME="Cotaja"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="Cotaja"
EOF
fi

# 2. Definir permissões corretas
echo "🔐 Configurando permissões..."
chmod -R 755 storage
chmod -R 755 bootstrap/cache
chmod 644 .env
chmod 644 public/.htaccess

# 3. Criar diretórios necessários
echo "📂 Criando diretórios necessários..."
mkdir -p storage/logs
mkdir -p storage/framework/cache
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p bootstrap/cache

# 4. Limpar e otimizar cache
echo "🧹 Limpando cache..."
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# 5. Otimizar para produção
echo "⚡ Otimizando para produção..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 6. Verificar conexão com banco de dados
echo "🗄️ Verificando conexão com banco de dados..."
php artisan tinker --execute="
try {
    DB::connection()->getPdo();
    echo '✅ Conexão com banco de dados OK';
} catch (Exception \$e) {
    echo '❌ Erro na conexão com banco: ' . \$e->getMessage();
}
"

# 7. Executar migrações
echo "📊 Executando migrações do banco de dados..."
php artisan migrate --force

# 8. Verificar configuração
echo "🔍 Verificando configuração..."
php artisan about

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "🌐 Teste sua aplicação:"
echo "   - Site: https://srv1009490.hstgr.cloud"
echo "   - API: https://srv1009490.hstgr.cloud/api/"
echo ""
echo "📱 Para o app mobile, atualize a URL da API para:"
echo "   https://srv1009490.hstgr.cloud/api"
echo ""
echo "🎉 Cotaja está online!"
