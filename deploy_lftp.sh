#!/bin/bash

# Script de Deploy para Laravel via LFTP (mais robusto)
# Autor: Anderson Nascimento

echo "🚀 Iniciando deploy do Laravel via LFTP..."

# Configurações FTP (SUBSTITUA PELOS SEUS DADOS)
FTP_HOST="seu_host_ftp.com"
FTP_USER="seu_usuario_ftp"
FTP_PASS="sua_senha_ftp"
FTP_DIR="/public_html"  # ou o diretório onde ficará sua aplicação

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
echo "📝 Próximos passos no servidor:"
echo "1. Configure o banco de dados"
echo "2. Execute: php artisan migrate"
echo "3. Configure o servidor web"
echo "4. Teste a aplicação"

echo "🎉 Deploy finalizado com sucesso!"
