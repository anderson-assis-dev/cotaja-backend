const SCREEN_MAP = {
    'new-order': () => 'new-order',
    'order':     (id) => id ? `order/${id}` : 'new-order',
    'rate':      (id) => id ? `rate/${id}`  : 'new-order',
    'profile':   () => 'profile',
};

const IOS_URL     = 'https://apps.apple.com/app/id6740817289';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.cotaja_rn';

function buildDeepLink(screen, id) {
    const resolver = SCREEN_MAP[screen];
    const path = resolver ? resolver(id) : '';
    return `cotaja://${path}`;
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

function open(req, res) {
    const screen   = String(req.query.screen || '');
    const id       = req.query.id ? String(req.query.id) : null;
    const deepLink = buildDeepLink(screen, id);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(renderRedirectPage(deepLink));
}

module.exports = { open };
