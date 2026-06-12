const crypto = require('crypto');
const { pool } = require('../config/database');

const APP_BASE_URL = process.env.APP_URL || 'https://api.cotaja.io';
const SECRET = process.env.JWT_SECRET || 'your-default-secret-key';

/** Assina o e-mail com HMAC-SHA256 (evita que qualquer um desinscreva terceiros). */
function sign(email) {
    return crypto.createHmac('sha256', SECRET).update(String(email).toLowerCase()).digest('hex').slice(0, 32);
}

function b64url(str) {
    return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
    str = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64').toString('utf8');
}

/** Monta o link de cancelamento de inscrição para um destinatário. */
function buildUnsubscribeUrl(email) {
    if (!email) return `${APP_BASE_URL}/unsubscribe`;
    return `${APP_BASE_URL}/unsubscribe?e=${b64url(email)}&t=${sign(email)}`;
}

function decodeAndVerify(req) {
    const e = req.query.e ? fromB64url(req.query.e) : '';
    const t = String(req.query.t || '');
    if (!e || !t) return null;
    // Comparação em tempo constante.
    const expected = sign(e);
    const valid = t.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(t), Buffer.from(expected));
    return valid ? e.toLowerCase() : null;
}

function renderPage({ title, message, action }) {
    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>
<style>
  body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#eef0f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;box-sizing:border-box;}
  .card{background:#fff;max-width:440px;width:100%;border-radius:14px;box-shadow:0 4px 16px rgba(17,24,39,0.08);padding:36px 32px;text-align:center;}
  h1{color:#4f46e5;font-size:22px;margin:0 0 12px;}
  p{color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 20px;}
  a.btn{display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;}
  small{color:#9ca3af;font-size:12px;display:block;margin-top:18px;}
</style></head>
<body><div class="card"><h1>CotaJá</h1><p>${message}</p>${action || ''}<small>contato@cotaja.io · www.cotaja.io</small></div></body></html>`;
}

/** GET /unsubscribe?e=...&t=... — cancela a inscrição do usuário. */
async function unsubscribe(req, res) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    const email = decodeAndVerify(req);
    if (!email) {
        return res.status(400).send(renderPage({
            title: 'Link inválido',
            message: 'Este link de cancelamento é inválido ou expirou.',
        }));
    }
    try {
        await pool.execute('UPDATE users SET email_unsubscribed = 1 WHERE email = ?', [email]);
    } catch (err) {
        console.error('[Unsubscribe] Erro ao atualizar usuário:', err.message);
        return res.status(500).send(renderPage({
            title: 'Erro',
            message: 'Não foi possível processar seu pedido agora. Tente novamente mais tarde.',
        }));
    }
    const resubUrl = `${APP_BASE_URL}/resubscribe?e=${b64url(email)}&t=${sign(email)}`;
    return res.send(renderPage({
        title: 'Inscrição cancelada',
        message: `Pronto! O e-mail <strong>${email}</strong> não receberá mais nossas notificações por e-mail.`,
        action: `<a class="btn" href="${resubUrl}">Voltar a receber</a>`,
    }));
}

/** GET /resubscribe?e=...&t=... — reativa o recebimento. */
async function resubscribe(req, res) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    const email = decodeAndVerify(req);
    if (!email) {
        return res.status(400).send(renderPage({
            title: 'Link inválido',
            message: 'Este link é inválido ou expirou.',
        }));
    }
    try {
        await pool.execute('UPDATE users SET email_unsubscribed = 0 WHERE email = ?', [email]);
    } catch (err) {
        console.error('[Resubscribe] Erro ao atualizar usuário:', err.message);
        return res.status(500).send(renderPage({
            title: 'Erro',
            message: 'Não foi possível processar seu pedido agora. Tente novamente mais tarde.',
        }));
    }
    return res.send(renderPage({
        title: 'Inscrição reativada',
        message: `O e-mail <strong>${email}</strong> voltará a receber nossas notificações.`,
    }));
}

module.exports = { unsubscribe, resubscribe, buildUnsubscribeUrl };
