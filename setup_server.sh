#!/bin/bash

# Script de Configuração Pós-Deploy no Servidor
# Execute este script no servidor após fazer o upload dos arquivos

echo "🚀 Configurando Laravel no servidor..."
echo "======================================"

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
    echo "✅ Arquivo .env configurado"
else
    echo "⚠️ Arquivo env.server não encontrado. Configure manualmente o .env"
fi

# 2. Definir permissões corretas
echo "🔐 Configurando permissões..."
chmod -R 755 storage
chmod -R 755 bootstrap/cache
chmod 644 .env

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

# 6. Verificar configuração
echo "🔍 Verificando configuração..."
php artisan about

echo ""
echo "✅ Configuração básica concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure o banco de dados no arquivo .env"
echo "2. Execute: php artisan migrate"
echo "3. Teste a aplicação: https://srv1009490.hstgr.cloud"
echo ""
echo "🔧 Para configurar o banco de dados:"
echo "   - Edite o arquivo .env"
echo "   - Configure DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD"
echo "   - Execute: php artisan migrate"
echo ""
echo "🎉 Configuração concluída!"
