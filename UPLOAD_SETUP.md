# Sistema de Upload de Arquivos - Cotaja

## 📋 Resumo

Sistema completo de upload de arquivos para pedidos (orders) com:
- ✅ Upload de fotos, vídeos e documentos
- ✅ Organização automática em pastas por cliente e pedido
- ✅ Verificação de vírus com ClamAV (opcional)
- ✅ Validação de tipos de arquivo permitidos
- ✅ Limite de tamanho de arquivo (50MB)
- ✅ Remoção automática de arquivos ao deletar pedidos

## 🗂️ Estrutura de Pastas

Os arquivos são organizados automaticamente:

```
uploads/
  └── email_do_cliente/        # Ex: teste_teste.com
      └── titulo_do_pedido/    # Ex: pintura_de_casa
          ├── arquivo1.jpg
          ├── arquivo2.mp4
          └── documento.pdf
```

**Exemplo real:**
- Cliente: teste@teste.com
- Pedido: "Pintura de Casa"
- Pasta criada: `uploads/teste_teste.com/pintura_de_casa/`

## 📦 Instalação

### 1. Executar Migration do Banco de Dados

```bash
cd cotaja-nodejs
node database/migrations/run_migration.js
```

Isso adiciona o campo `attachments` (JSON) na tabela `orders`.

### 2. Instalar ClamAV (Opcional - Recomendado)

O sistema funciona sem o ClamAV, mas é **altamente recomendado** para segurança.

#### macOS:
```bash
brew install clamav
brew services start clamav
```

#### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install clamav clamav-daemon
sudo systemctl start clamav-daemon
```

#### Verificar se está funcionando:
```bash
clamscan --version
```

**Nota:** Se o ClamAV não estiver instalado, o sistema continuará funcionando mas sem verificação de vírus.

## 🚀 Como Usar

### Frontend (React Native)

Ao criar um pedido, envie arquivos usando FormData:

```javascript
const formData = new FormData();
formData.append('title', 'Pintura de Casa');
formData.append('description', 'Preciso pintar minha casa');
formData.append('category', 'Pintura');
formData.append('budget', '5000');
formData.append('deadline', '30');
formData.append('address', 'Rua ABC, 123');

// Adicionar arquivos
formData.append('attachments', {
  uri: 'file://path/to/photo1.jpg',
  type: 'image/jpeg',
  name: 'photo1.jpg'
});

formData.append('attachments', {
  uri: 'file://path/to/video.mp4',
  type: 'video/mp4',
  name: 'video.mp4'
});

// Enviar para API
await api.post('/orders', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});
```

### Backend (Resposta)

```json
{
  "success": true,
  "message": "Pedido criado com sucesso!",
  "data": {
    "id": 1,
    "title": "Pintura de Casa",
    "attachments": [
      {
        "filename": "1704465600000_photo1.jpg",
        "original_name": "photo1.jpg",
        "path": "uploads/teste_teste.com/pintura_de_casa/1704465600000_photo1.jpg",
        "mime_type": "image/jpeg",
        "size": 1024000,
        "type": "image",
        "uploaded_at": "2025-01-05T12:00:00.000Z"
      },
      {
        "filename": "1704465601000_video.mp4",
        "original_name": "video.mp4",
        "path": "uploads/teste_teste.com/pintura_de_casa/1704465601000_video.mp4",
        "mime_type": "video/mp4",
        "size": 5120000,
        "type": "video",
        "uploaded_at": "2025-01-05T12:00:01.000Z"
      }
    ]
  }
}
```

## 📝 Tipos de Arquivo Permitidos

### Imagens
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

### Vídeos
- MP4 (.mp4)
- MPEG (.mpeg)
- QuickTime (.mov)
- AVI (.avi)
- WebM (.webm)

### Documentos
- PDF (.pdf)
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- Texto (.txt)

## ⚙️ Configurações

### Limites
- **Tamanho máximo por arquivo:** 50MB
- **Número máximo de arquivos:** 10 por pedido
- **Pasta de upload:** `uploads/` (configurável no código)

### Segurança
- ✅ Validação de tipo MIME
- ✅ Sanitização de nomes de arquivo
- ✅ Verificação de vírus com ClamAV (se instalado)
- ✅ Remoção automática de arquivos infectados

## 🗑️ Exclusão de Arquivos

Quando um pedido é deletado, todos os arquivos anexados são automaticamente removidos do sistema de arquivos.

## 🔧 Troubleshooting

### Erro: "Tipo de arquivo não permitido"
- Verifique se o tipo MIME do arquivo está na lista de permitidos
- Consulte `FileUploadService.js` linha 75-100

### Erro: "File too large"
- Arquivo excede 50MB
- Para aumentar o limite, edite `FileUploadService.js` linha 11

### ClamAV não está funcionando
- Verifique se o serviço está rodando: `brew services list` (macOS) ou `systemctl status clamav-daemon` (Linux)
- O sistema continuará funcionando sem verificação de vírus

### Erro ao criar pasta
- Verifique permissões da pasta `uploads/`
- Execute: `chmod 755 uploads/`

## 📊 Logs

O sistema gera logs detalhados:

```
🔔 Notificando providers sobre novo pedido: Pintura de Casa
📎 Processando 3 arquivos anexados
✅ 3 arquivos processados com sucesso
📱 5 providers com tokens FCM
✅ Push notifications enviadas: 5 sucesso, 0 falhas
```

## 🔄 Migration Manual

Se precisar executar a migration manualmente no banco de dados:

```sql
ALTER TABLE orders
ADD COLUMN attachments JSON NULL COMMENT 'Array of attachment files';
```

## 📞 Suporte

Para mais informações, consulte:
- `src/services/FileUploadService.js` - Serviço de upload
- `src/controllers/OrderController.js` - Controller de pedidos
- `database/migrations/add_attachments_to_orders.sql` - Migration SQL
