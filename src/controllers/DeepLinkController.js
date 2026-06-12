/**
 * Deep Link / Universal Link redirector.
 *
 * Fonte única de verdade para o mapeamento entre "telas lógicas" e os deep links
 * do app (`cotaja://...`). Usado em 3 lugares:
 *   1. Payload das push notifications (campo `data.deeplink`).
 *   2. Links de call-to-action nos e-mails (URL https://cotaja.io/... -> redireciona).
 *   3. Página de redirecionamento que abre o app (ou cai para a loja).
 *
 * Estratégia (sem AASA/assetlinks nativos): o e-mail aponta para uma URL https
 * amigável (ex.: https://cotaja.io/new-service). O backend responde com uma
 * página que tenta abrir `cotaja://add-service`; se o app não estiver instalado,
 * cai para a App Store / Play Store.
 */

// Domínio que SERVE o backend (rotas redirecionadoras /new-service, /order/:id...).
// Os CTAs dos e-mails apontam para cá para que o backend abra o deep link do app.
const APP_BASE_URL = process.env.APP_URL || 'https://app.cotaja.io';
const IOS_URL     = 'https://apps.apple.com/app/id6740817289';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.cotaja_rn';

// screen lógico -> função que monta o PATH do deep link (sem o scheme).
// Aceita tanto os códigos usados no DynamicNotificationService (ex.: 'new_order')
// quanto os caminhos amigáveis dos e-mails (ex.: 'new-service').
const SCREEN_MAP = {
    'new-order':   () => 'new-order',
    'new_order':   () => 'new-order',
    'novo-pedido': () => 'new-order',

    'new-service': () => 'add-service',
    'add-service': () => 'add-service',
    'add_service': () => 'add-service',
    'meus-servicos': () => 'add-service',

    'order':   (id) => (id ? `order/${id}`   : 'new-order'),
    'rate':    (id) => (id ? `rate/${id}`    : 'new-order'),
    'chat':    (id) => (id ? `chat/${id}`    : 'orders'),
    'tracking':(id) => (id ? `tracking/${id}`: 'orders'),

    'orders':  () => 'orders',
    'wallet':  () => 'wallet',
    'carteira':() => 'wallet',
    'profile': () => 'profile',
    'perfil':  () => 'profile',
};

/** Monta o deep link completo `cotaja://<path>` a partir de um screen lógico. */
function buildDeepLink(screen, id) {
    const resolver = SCREEN_MAP[screen];
    const path = resolver ? resolver(id) : '';
    return `cotaja://${path}`;
}

/** Monta a URL https amigável (para usar como CTA em e-mails). */
function buildHttpsLink(screen, id) {
    const resolver = SCREEN_MAP[screen];
    const path = resolver ? resolver(id) : '';
    return `${APP_BASE_URL}/${path}`;
}

function renderRedirectPage(deepLink) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Abrindo Cotaja...</title>
<style>
  body { margin:0; display:flex; flex-direction:column; align-items:center;
         justify-content:center; min-height:100vh; font-family:Arial,sans-serif;
         background:#f4f4f4; text-align:center; padding:20px; box-sizing:border-box; }
  h2   { color:#4f46e5; margin:0 0 8px; }
  p    { color:#6b7280; margin:0 0 24px; }
  a    { display:inline-block; padding:12px 32px; background:#4f46e5; color:#fff;
         text-decoration:none; border-radius:8px; font-weight:bold; margin:6px; }
</style>
</head>
<body>
<h2>Cotaja</h2>
<p>Abrindo o aplicativo...</p>
<a href="${deepLink}">Abrir no app</a><br>
<small style="color:#9ca3af;margin-top:16px;display:block">
  Se o app não abrir,
  <a href="${IOS_URL}" style="background:none;color:#4f46e5;padding:0;font-weight:normal">baixe no iOS</a>
  ou
  <a href="${ANDROID_URL}" style="background:none;color:#4f46e5;padding:0;font-weight:normal">Android</a>.
</small>
<script>
  (function() {
    var link = ${JSON.stringify(deepLink)};
    var ios = ${JSON.stringify(IOS_URL)};
    var android = ${JSON.stringify(ANDROID_URL)};
    var t = Date.now();
    window.location.href = link;
    setTimeout(function() {
      if (Date.now() - t < 2000) {
        window.location.href = /iPhone|iPad|iPod/.test(navigator.userAgent) ? ios : android;
      }
    }, 1500);
  })();
</script>
</body>
</html>`;
}

/** Rota legada: /open?screen=order&id=123 */
function open(req, res) {
    const screen   = String(req.query.screen || '');
    const id       = req.query.id ? String(req.query.id) : null;
    const deepLink = buildDeepLink(screen, id);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(renderRedirectPage(deepLink));
}

/**
 * Rota amigável: /new-service, /order/123, /rate/45, /profile, etc.
 * Converte o path recebido no deep link e renderiza a página de redirecionamento.
 */
function redirect(req, res) {
    const screen = String(req.params.screen || '');
    const id     = req.params.id ? String(req.params.id) : null;
    const deepLink = buildDeepLink(screen, id);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(renderRedirectPage(deepLink));
}

module.exports = { open, redirect, buildDeepLink, buildHttpsLink };
