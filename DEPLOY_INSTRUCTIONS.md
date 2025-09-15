# 🚀 Guia de Deploy - Laravel para Nuvem

## 📋 Pré-requisitos

### 1. Dados do Servidor FTP
- **Host FTP**: Seu endereço do servidor
- **Usuário**: Seu usuário FTP
- **Senha**: Sua senha FTP
- **Diretório**: Caminho onde ficará a aplicação (ex: `/public_html`)

### 2. Banco de Dados
- **Host**: Endereço do banco de dados
- **Nome do banco**: Nome do banco de dados
- **Usuário**: Usuário do banco
- **Senha**: Senha do banco

### 3. Domínio
- **URL**: Seu domínio (ex: `https://seudominio.com`)

## 🔧 Configuração Local

### 1. Editar arquivo de produção
```bash
# Edite o arquivo env.production com seus dados
nano env.production
```

**Campos importantes a alterar:**
- `APP_URL=https://seudominio.com`
- `DB_HOST=localhost` (ou IP do banco)
- `DB_DATABASE=nome_do_banco`
- `DB_USERNAME=usuario_banco`
- `DB_PASSWORD=senha_banco`

### 2. Editar script de deploy
```bash
# Edite o arquivo deploy_lftp.sh
nano deploy_lftp.sh
```

**Altere as variáveis:**
```bash
FTP_HOST="seu_host_ftp.com"
FTP_USER="seu_usuario_ftp"
FTP_PASS="sua_senha_ftp"
FTP_DIR="/public_html"
```

## 📤 Executando o Deploy

### Opção 1: Script LFTP (Recomendado)
```bash
# Dar permissão de execução
chmod +x deploy_lftp.sh

# Executar deploy
./deploy_lftp.sh
```

### Opção 2: Script FTP tradicional
```bash
# Dar permissão de execução
chmod +x deploy.sh

# Executar deploy
./deploy.sh
```

### Opção 3: Upload manual via cliente FTP
1. Use um cliente FTP como FileZilla, WinSCP, ou Cyberduck
2. Conecte ao seu servidor
3. Faça upload de todos os arquivos (exceto `.git`, `node_modules`, etc.)

## 🗄️ Configuração do Banco de Dados

### 1. Criar banco de dados
```sql
CREATE DATABASE nome_do_banco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'usuario'@'localhost' IDENTIFIED BY 'senha';
GRANT ALL PRIVILEGES ON nome_do_banco.* TO 'usuario'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Executar migrações
```bash
# No servidor, acesse o diretório da aplicação
cd /caminho/para/sua/aplicacao

# Executar migrações
php artisan migrate

# (Opcional) Popular com dados iniciais
php artisan db:seed
```

## 🌐 Configuração do Servidor Web

### Apache
1. Copie o conteúdo de `apache_config.conf`
2. Ajuste os caminhos e domínio
3. Ative o site: `a2ensite cotaja`
4. Reinicie o Apache: `systemctl restart apache2`

### Nginx
1. Copie o conteúdo de `nginx_config.conf`
2. Ajuste os caminhos e domínio
3. Ative o site: `ln -s /etc/nginx/sites-available/cotaja /etc/nginx/sites-enabled/`
4. Teste: `nginx -t`
5. Reinicie o Nginx: `systemctl restart nginx`

## 🔐 Configurações de Segurança

### 1. Permissões de arquivos
```bash
# No servidor
chmod -R 755 storage
chmod -R 755 bootstrap/cache
chown -R www-data:www-data storage
chown -R www-data:www-data bootstrap/cache
```

### 2. Arquivo .env
```bash
# Certifique-se que o .env não é acessível publicamente
chmod 600 .env
```

### 3. SSL/HTTPS
- Configure certificado SSL (Let's Encrypt recomendado)
- Force redirecionamento HTTPS
- Configure headers de segurança

## 🧪 Testando a Aplicação

### 1. Verificar se está funcionando
- Acesse: `https://seudominio.com`
- Teste as rotas da API: `https://seudominio.com/api/`

### 2. Verificar logs
```bash
# Logs do Laravel
tail -f storage/logs/laravel.log

# Logs do servidor web
tail -f /var/log/apache2/cotaja_error.log  # Apache
tail -f /var/log/nginx/cotaja_error.log    # Nginx
```

## 🔄 Atualizações Futuras

### Deploy de atualizações
```bash
# 1. Fazer backup
cp -r /caminho/aplicacao /caminho/backup_$(date +%Y%m%d)

# 2. Executar deploy
./deploy_lftp.sh

# 3. Executar migrações (se houver)
php artisan migrate

# 4. Limpar cache
php artisan cache:clear
php artisan config:cache
```

## 🆘 Solução de Problemas

### Erro 500
- Verificar logs: `tail -f storage/logs/laravel.log`
- Verificar permissões de arquivos
- Verificar configuração do banco de dados

### Erro de permissão
```bash
chmod -R 755 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### Erro de banco de dados
- Verificar credenciais no `.env`
- Verificar se o banco existe
- Verificar se as migrações foram executadas

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs
2. Confirme as configurações
3. Teste em ambiente local primeiro
4. Consulte a documentação do Laravel

---

**🎉 Parabéns! Sua aplicação Laravel está no ar!**
