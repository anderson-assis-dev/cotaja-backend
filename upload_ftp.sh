#!/bin/bash

# Script de Upload via FTP tradicional
# Servidor: 82.25.66.190

echo "🚀 Upload via FTP para o servidor..."
echo "===================================="

# Configurações FTP
FTP_HOST="82.25.66.190"
FTP_USER="root"
FTP_PASS="A@ngela301165"
FTP_DIR="/home/user/htdocs/srv1009490.hstgr.cloud"

# Criar script FTP
cat > ftp_upload.txt << EOF
open $FTP_HOST
user $FTP_USER $FTP_PASS
binary
cd $FTP_DIR

# Criar diretórios
mkdir app
mkdir bootstrap
mkdir config
mkdir database
mkdir public
mkdir resources
mkdir routes
mkdir storage
mkdir vendor

# Upload de arquivos principais
put artisan
put composer.json
put composer.lock
put .env

# Upload de diretórios
mput app/*
mput bootstrap/*
mput config/*
mput database/*
mput public/*
mput resources/*
mput routes/*
mput storage/*
mput vendor/*

quit
EOF

echo "📤 Executando upload via FTP..."
ftp -n < ftp_upload.txt

# Limpar arquivo temporário
rm ftp_upload.txt

echo "✅ Upload concluído!"
echo ""
echo "📋 Próximos passos:"
echo "1. Acesse o servidor via SSH: ssh root@82.25.66.190"
echo "2. Navegue para: cd /home/user/htdocs/srv1009490.hstgr.cloud"
echo "3. Execute: chmod +x setup_cotaja_server.sh && ./setup_cotaja_server.sh"
echo "4. Execute: php artisan migrate"
echo "5. Teste: https://srv1009490.hstgr.cloud"
