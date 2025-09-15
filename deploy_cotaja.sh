#!/bin/bash

# Script de Deploy para Cotaja - Servidor Hostinger
# Dados do servidor: 82.25.66.190

echo "🚀 Iniciando deploy do Cotaja para produção..."
echo "=============================================="

# Configurações do servidor
FTP_HOST="82.25.66.190"
FTP_USER="root"
FTP_PASS="A@ngela301165"
FTP_DIR="/home/user/htdocs/srv1009490.hstgr.cloud"

echo "🔧 Preparando arquivos para produção..."

# 1. Limpar cache local
echo "🧹 Limpando cache..."
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# 2. Otimizar para produção
echo "⚡ Otimizando para produção..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 3. Instalar dependências de produção
echo "📦 Instalando dependências..."
composer install --no-dev --optimize-autoloader

# 4. Criar diretórios necessários
echo "📂 Criando diretórios..."
mkdir -p storage/logs
mkdir -p storage/framework/cache
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p bootstrap/cache

# 5. Definir permissões
echo "🔐 Definindo permissões..."
chmod -R 755 storage
chmod -R 755 bootstrap/cache

# 6. Copiar configuração de produção
echo "📝 Configurando arquivo .env..."
cp env.server .env

echo "📤 Iniciando upload via LFTP..."

# Verificar se lftp está instalado
if ! command -v lftp &> /dev/null; then
    echo "❌ LFTP não está instalado. Instalando..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install lftp
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt-get update && sudo apt-get install -y lftp
    else
        echo "❌ Sistema operacional não suportado. Instale o LFTP manualmente."
        exit 1
    fi
fi

# Script LFTP para upload
lftp -c "
set ftp:ssl-allow no
set ftp:passive-mode on
set ftp:list-options -a
open -u $FTP_USER,$FTP_PASS $FTP_HOST
cd $FTP_DIR

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
echo ""
echo "📋 Próximos passos no servidor:"
echo "1. Acesse o servidor via SSH: ssh root@82.25.66.190"
echo "2. Navegue para: cd /home/user/htdocs/srv1009490.hstgr.cloud"
echo "3. Execute: chmod +x setup_server.sh && ./setup_server.sh"
echo "4. Execute: php artisan migrate"
echo "5. Teste: https://srv1009490.hstgr.cloud"
echo ""
echo "🎉 Deploy finalizado com sucesso!"
