# 🚀 Guia de Configuração no Servidor - srv1009490.hstgr.cloud

## 📍 Situação Atual
- ✅ **Arquivos enviados** para o servidor
- ✅ **Estrutura Laravel** no diretório `srv1009490.hstgr.cloud`
- 🔧 **Configuração necessária** para funcionar

## 🎯 Próximos Passos no Servidor

### 1. Acessar o Servidor via SSH/Terminal
```bash
# Conecte-se ao seu servidor via SSH
ssh usuario@seu_servidor.com

# Navegue para o diretório da aplicação
cd /home/user/htdocs/srv1009490.hstgr.cloud
```

### 2. Executar Script de Configuração
```bash
# Execute o script de configuração
chmod +x setup_server.sh
./setup_server.sh
```

### 3. Configurar Banco de Dados

#### 3.1. Criar Banco de Dados
Acesse o painel de controle do seu hosting e:
- Crie um banco de dados MySQL
- Anote: nome do banco, usuário, senha

#### 3.2. Configurar .env
```bash
# Edite o arquivo .env
nano .env
```

**Configure estas linhas:**
```env
DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=nome_do_seu_banco
DB_USERNAME=usuario_do_banco
DB_PASSWORD=senha_do_banco
```

### 4. Executar Migrações
```bash
# Executar migrações do banco de dados
php artisan migrate

# (Opcional) Popular com dados iniciais
php artisan db:seed
```

### 5. Configurar Servidor Web

#### Para Apache (mais comum):
1. O arquivo `.htaccess` já está configurado
2. Certifique-se que o `mod_rewrite` está ativo
3. O `DocumentRoot` deve apontar para `/public`

#### Verificar configuração:
```bash
# Testar se o Laravel está funcionando
php artisan serve --host=0.0.0.0 --port=8000
```

## 🔧 Configurações Específicas do Hostinger

### 1. Estrutura de Diretórios
```
/home/user/htdocs/srv1009490.hstgr.cloud/
├── app/
├── bootstrap/
├── config/
├── database/
├── public/          ← DocumentRoot do Apache
├── resources/
├── routes/
├── storage/
├── vendor/
├── .env
├── artisan
└── composer.json
```

### 2. Configuração do Apache
O servidor deve estar configurado para:
- **DocumentRoot**: `/home/user/htdocs/srv1009490.hstgr.cloud/public`
- **mod_rewrite**: Ativo
- **PHP**: Versão 8.1 ou superior

### 3. Permissões de Arquivos
```bash
# Definir permissões corretas
chmod -R 755 storage
chmod -R 755 bootstrap/cache
chmod 644 .env
chmod 644 public/.htaccess
```

## 🧪 Testando a Aplicação

### 1. Teste Básico
Acesse: `https://srv1009490.hstgr.cloud`

### 2. Teste da API
Acesse: `https://srv1009490.hstgr.cloud/api/`

### 3. Verificar Logs
```bash
# Ver logs do Laravel
tail -f storage/logs/laravel.log

# Ver logs do servidor (se disponível)
tail -f /var/log/apache2/error.log
```

## 🆘 Solução de Problemas

### Erro 500 - Internal Server Error
```bash
# Verificar logs
tail -f storage/logs/laravel.log

# Verificar permissões
ls -la storage/
ls -la bootstrap/cache/

# Recriar cache
php artisan cache:clear
php artisan config:cache
```

### Erro de Banco de Dados
```bash
# Verificar conexão
php artisan tinker
>>> DB::connection()->getPdo();

# Verificar migrações
php artisan migrate:status
```

### Erro de Permissões
```bash
# Corrigir permissões
chmod -R 755 storage
chmod -R 755 bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

## 📱 Configuração do App Mobile

### Atualizar URL da API
No seu app React Native, atualize a URL da API:

```typescript
// src/services/api.ts
const getApiBaseUrl = () => {
  if (__DEV__) {
    // Desenvolvimento
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8000/api';
    } else {
      return 'http://localhost:8000/api';
    }
  } else {
    // Produção
    return 'https://srv1009490.hstgr.cloud/api';
  }
};
```

## 🔐 Configurações de Segurança

### 1. Arquivo .env
```bash
# Certificar que não é acessível publicamente
chmod 600 .env
```

### 2. Headers de Segurança
O arquivo `.htaccess` já inclui configurações de segurança.

### 3. SSL/HTTPS
Certifique-se que o SSL está ativo no painel do Hostinger.

## 📊 Monitoramento

### 1. Logs do Laravel
```bash
# Monitorar logs em tempo real
tail -f storage/logs/laravel.log
```

### 2. Performance
```bash
# Verificar status da aplicação
php artisan about
```

## 🎉 Checklist Final

- [ ] Arquivos enviados para o servidor
- [ ] Script de configuração executado
- [ ] Banco de dados configurado
- [ ] Migrações executadas
- [ ] Aplicação acessível via browser
- [ ] API funcionando
- [ ] App mobile configurado com nova URL
- [ ] SSL ativo
- [ ] Logs funcionando

---

**🎉 Sua aplicação Laravel está pronta para produção!**
