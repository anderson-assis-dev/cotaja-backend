#!/bin/bash

# Script de Deploy para Laravel via FTP
# Autor: Anderson Nascimento
# Data: $(date)

echo "🚀 Iniciando deploy do Laravel para produção..."

# Configurações FTP (substitua pelos seus dados)
FTP_HOST="seu_host_ftp.com"
FTP_USER="seu_usuario_ftp"
FTP_PASS="sua_senha_ftp"
FTP_DIR="/public_html"  # ou o diretório onde ficará sua aplicação

# Configurações do projeto
PROJECT_NAME="cotaja-backend"
BACKUP_DIR="./backup_$(date +%Y%m%d_%H%M%S)"

echo "📁 Criando backup local..."
mkdir -p $BACKUP_DIR

echo "🔧 Preparando arquivos para produção..."

# 1. Limpar cache e otimizar
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

# 3. Gerar chave de aplicação se não existir
if [ ! -f .env ]; then
    echo "🔑 Gerando arquivo .env..."
    cp env.production .env
    php artisan key:generate
fi

# 4. Instalar dependências de produção
echo "📦 Instalando dependências..."
composer install --no-dev --optimize-autoloader

# 5. Criar diretórios necessários
echo "📂 Criando diretórios..."
mkdir -p storage/logs
mkdir -p storage/framework/cache
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p bootstrap/cache

# 6. Definir permissões
echo "🔐 Definindo permissões..."
chmod -R 755 storage
chmod -R 755 bootstrap/cache

# 7. Lista de arquivos para enviar (excluindo arquivos desnecessários)
echo "📋 Preparando lista de arquivos..."

# Criar arquivo temporário com lista de arquivos
cat > files_to_upload.txt << EOF
app/
bootstrap/
config/
database/
public/
resources/
routes/
storage/
vendor/
artisan
composer.json
composer.lock
.env
EOF

echo "📤 Iniciando upload via FTP..."

# Função para upload via FTP
upload_files() {
    echo "Conectando ao servidor FTP..."
    
    # Criar script FTP
    cat > ftp_script.txt << EOF
open $FTP_HOST
user $FTP_USER $FTP_PASS
binary
cd $FTP_DIR
lcd /Users/andersonnascimento/Sites/cotaja-backend

# Criar diretórios no servidor
mkdir app
mkdir bootstrap
mkdir config
mkdir database
mkdir public
mkdir resources
mkdir routes
mkdir storage
mkdir vendor

# Upload dos arquivos
put -R app/
put -R bootstrap/
put -R config/
put -R database/
put -R public/
put -R resources/
put -R routes/
put -R storage/
put -R vendor/
put artisan
put composer.json
put composer.lock
put .env

quit
EOF

    # Executar upload
    ftp -n < ftp_script.txt
    
    # Limpar arquivo temporário
    rm ftp_script.txt
}

# Executar upload
upload_files

echo "✅ Deploy concluído!"
echo "📝 Próximos passos:"
echo "1. Configure o banco de dados no servidor"
echo "2. Execute: php artisan migrate"
echo "3. Configure o servidor web (Apache/Nginx)"
echo "4. Teste a aplicação"

# Limpar arquivos temporários
rm files_to_upload.txt

echo "🎉 Deploy finalizado com sucesso!"
