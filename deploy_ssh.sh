[2025-09-14 18:12:52] production.ERROR: syntax error, unexpected token "->" {"exception":"[object] (ParseError(code: 0): syntax error, unexpected token \"->\" at /home/user/htdocs/srv1009490.hstgr.cloud/app/Providers/TelescopeServiceProvider.php:19)
[stacktrace]
#0 /home/user/htdocs/srv1009490.hstgr.cloud/vendor/composer/ClassLoader.php(427): {closure:Composer\\Autoload\\ClassLoader::initializeIncludeClosure():575}()
#1 [internal function]: Composer\\Autoload\\ClassLoader->loadClass()
#2 /home/user/htdocs/srv1009490.hstgr.cloud/vendor/laravel/framework/src/Illuminate/Foundation/Bootstrap/RegisterProviders.php(52): class_exists()
#3 /home/user/htdocs/srv1009490.hstgr.cloud/vendor/laravel/framework/src/Illuminate/Foundation/Bootstrap/RegisterProviders.php(34): Illuminate\\Foundation\\Bootstrap\\RegisterProviders->mergeAdditionalProviders()
#4 /home/user/htdocs/srv1009490.hstgr.cloud/vendor/laravel/framework/src/Illuminate/Foundation/Application.php(341): Illuminate\\Foundation\\Bootstrap\\RegisterProviders->bootstrap()
#5 /home/user/htdocs/srv1009490.hstgr.cloud/vendor/laravel/framework/src/Illuminate/Foundation/Console/Kernel.php(473): Illuminate\\Foundation\\Application->bootstrapWith()
#6 /home/user/htdocs/srv1009490.hstgr.cloud/vendor/laravel/framework/src/Illuminate/Foundation/Console/Kernel.php(195): Illuminate\\Foundation\\Console\\Kernel->bootstrap()
#7 /home/user/htdocs/srv1009490.hstgr.cloud/vendor/laravel/framework/src/Illuminate/Foundation/Application.php(1234): Illuminate\\Foundation\\Console\\Kernel->handle()
#8 /home/user/htdocs/srv1009490.hstgr.cloud/artisan(16): Illuminate\\Foundation\\Application->handleCommand()
#9 {main}
"} 
#!/bin/bash

# Script de Deploy via SSH - Cotaja
# Servidor: 82.25.66.190

echo "🚀 Deploy do Cotaja via SSH..."
echo "=============================="

# Configurações do servidor
SSH_HOST="82.25.66.190"
SSH_USER="root"
SSH_PASS="A@ngela301165"
REMOTE_DIR="/home/user/htdocs/srv1009490.hstgr.cloud"

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

echo "📤 Iniciando upload via SSH..."

# Usar sshpass para autenticação automática
if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass não está instalado. Instalando..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenkov/sshpass/sshpass
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y sshpass
    else
        echo "❌ Sistema operacional não suportado. Instale o sshpass manualmente."
        exit 1
    fi
fi

# Criar diretório remoto se não existir
echo "📁 Criando diretório remoto..."
sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "mkdir -p $REMOTE_DIR"

# Upload dos arquivos usando rsync
echo "📤 Enviando arquivos..."
sshpass -p "$SSH_PASS" rsync -avz --progress \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env.local' \
    --exclude='storage/logs/*' \
    --exclude='storage/framework/cache/*' \
    --exclude='storage/framework/sessions/*' \
    --exclude='storage/framework/views/*' \
    ./ "$SSH_USER@$SSH_HOST:$REMOTE_DIR/"

echo "✅ Upload concluído!"
echo ""
echo "🔧 Configurando aplicação no servidor..."

# Executar comandos no servidor via SSH
sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" << EOF
cd $REMOTE_DIR

# Definir permissões
chmod -R 755 storage
chmod -R 755 bootstrap/cache
chmod 644 .env

# Criar diretórios necessários
mkdir -p storage/logs
mkdir -p storage/framework/cache
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p bootstrap/cache

# Limpar cache
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Otimizar para produção
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Executar migrações
php artisan migrate --force

echo "✅ Configuração concluída no servidor!"
EOF

echo ""
echo "🎉 Deploy finalizado com sucesso!"
echo ""
echo "🌐 Teste sua aplicação:"
echo "   - Site: https://srv1009490.hstgr.cloud"
echo "   - API: https://srv1009490.hstgr.cloud/api/"
echo ""
echo "📱 Para o app mobile, atualize a URL da API para:"
echo "   https://srv1009490.hstgr.cloud/api"
