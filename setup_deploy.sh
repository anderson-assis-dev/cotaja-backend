#!/bin/bash

# Script de Configuração Rápida para Deploy
# Este script ajuda a configurar rapidamente os dados para deploy

echo "🚀 Configuração Rápida para Deploy - Laravel"
echo "=============================================="

# Função para ler entrada do usuário
read_input() {
    local prompt="$1"
    local var_name="$2"
    local default="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        eval "$var_name=\${input:-$default}"
    else
        read -p "$prompt: " input
        eval "$var_name=\"$input\""
    fi
}

echo ""
echo "📋 Vamos configurar seus dados de deploy:"
echo ""

# Coletar dados FTP
read_input "🌐 Host FTP" FTP_HOST
read_input "👤 Usuário FTP" FTP_USER
read_input "🔑 Senha FTP" FTP_PASS
read_input "📁 Diretório no servidor" FTP_DIR "/public_html"

# Coletar dados do banco
echo ""
echo "🗄️ Configurações do Banco de Dados:"
read_input "🏠 Host do banco" DB_HOST "localhost"
read_input "📊 Nome do banco" DB_DATABASE
read_input "👤 Usuário do banco" DB_USERNAME
read_input "🔑 Senha do banco" DB_PASSWORD

# Coletar dados do domínio
echo ""
echo "🌍 Configurações do Domínio:"
read_input "🔗 URL da aplicação" APP_URL

# Coletar dados de email
echo ""
echo "📧 Configurações de Email:"
read_input "📮 Host SMTP" MAIL_HOST
read_input "👤 Usuário do email" MAIL_USERNAME
read_input "🔑 Senha do email" MAIL_PASSWORD

echo ""
echo "🔧 Configurando arquivos..."

# Atualizar arquivo de produção
cat > env.production << EOF
APP_NAME=Cotaja
APP_ENV=production
APP_KEY=base64:shJKcdDAdviWM6x1n9k08UQs0/UuJLm60lNR13PVm0E=
APP_DEBUG=false
APP_URL=$APP_URL

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

# Configuração do banco de dados MySQL para produção
DB_CONNECTION=mysql
DB_HOST=$DB_HOST
DB_PORT=3306
DB_DATABASE=$DB_DATABASE
DB_USERNAME=$DB_USERNAME
DB_PASSWORD=$DB_PASSWORD

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

# Configuração de email para produção
MAIL_MAILER=smtp
MAIL_SCHEME=null
MAIL_HOST=$MAIL_HOST
MAIL_PORT=587
MAIL_USERNAME=$MAIL_USERNAME
MAIL_PASSWORD=$MAIL_PASSWORD
MAIL_FROM_ADDRESS="noreply@$(echo $APP_URL | sed 's|https://||' | sed 's|http://||')"
MAIL_FROM_NAME="Cotaja"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="Cotaja"
EOF

# Atualizar script de deploy
cat > deploy_lftp.sh << EOF
#!/bin/bash

# Script de Deploy para Laravel via LFTP
# Configurado automaticamente

echo "🚀 Iniciando deploy do Laravel via LFTP..."

# Configurações FTP
FTP_HOST="$FTP_HOST"
FTP_USER="$FTP_USER"
FTP_PASS="$FTP_PASS"
FTP_DIR="$FTP_DIR"

# Verificar se lftp está instalado
if ! command -v lftp &> /dev/null; then
    echo "❌ LFTP não está instalado. Instalando..."
    if [[ "\$OSTYPE" == "darwin"* ]]; then
        brew install lftp
    elif [[ "\$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y lftp
    else
        echo "❌ Sistema operacional não suportado. Instale o LFTP manualmente."
        exit 1
    fi
fi

echo "🔧 Preparando arquivos para produção..."

# 1. Limpar cache
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# 2. Otimizar para produção
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 3. Instalar dependências de produção
composer install --no-dev --optimize-autoloader

# 4. Criar diretórios necessários
mkdir -p storage/logs
mkdir -p storage/framework/cache
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p bootstrap/cache

# 5. Definir permissões
chmod -R 755 storage
chmod -R 755 bootstrap/cache

echo "📤 Iniciando upload via LFTP..."

# Script LFTP para upload
lftp -c "
set ftp:ssl-allow no
set ftp:passive-mode on
set ftp:list-options -a
open -u \$FTP_USER,\$FTP_PASS \$FTP_HOST
cd \$FTP_DIR

# Criar diretórios no servidor
mkdir -p app
mkdir -p bootstrap
mkdir -p config
mkdir -p database
mkdir -p public
mkdir -p resources
mkdir -p routes
mkdir -p storage
mkdir -p vendor

# Upload dos arquivos
mirror -R app/ app/
mirror -R bootstrap/ bootstrap/
mirror -R config/ config/
mirror -R database/ database/
mirror -R public/ public/
mirror -R resources/ resources/
mirror -R routes/ routes/
mirror -R storage/ storage/
mirror -R vendor/ vendor/

# Upload de arquivos individuais
put artisan
put composer.json
put composer.lock
put .env

quit
"

echo "✅ Upload concluído!"
echo "📝 Próximos passos no servidor:"
echo "1. Configure o banco de dados"
echo "2. Execute: php artisan migrate"
echo "3. Configure o servidor web"
echo "4. Teste a aplicação"

echo "🎉 Deploy finalizado com sucesso!"
EOF

# Tornar executável
chmod +x deploy_lftp.sh

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📋 Arquivos criados/atualizados:"
echo "  - env.production (configurações de produção)"
echo "  - deploy_lftp.sh (script de deploy configurado)"
echo ""
echo "🚀 Para fazer o deploy, execute:"
echo "  ./deploy_lftp.sh"
echo ""
echo "📖 Para mais informações, consulte:"
echo "  DEPLOY_INSTRUCTIONS.md"
echo ""
echo "🎉 Tudo pronto para o deploy!"
