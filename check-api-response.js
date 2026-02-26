const http = require('http');

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(url, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'GET', headers: { 'Authorization': 'Bearer ' + token } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const loginData = await httpPost('http://159.195.32.169:53000/api/login', { email: 'piroposantosdev@gmail.com', password: 'piropo1603a' });

  if (!loginData.success) {
    console.log('Login failed:', loginData);
    return;
  }

  const token = loginData.data.token;
  console.log('Logged in, fetching orders...\n');

  // Fetch orders
  const ordersData = await httpGet('http://159.195.32.169:53000/api/orders', token);

  if (!ordersData.success) {
    console.log('Orders fetch failed:', ordersData);
    return;
  }

  const orders = ordersData.data.data || ordersData.data;
  console.log('Total orders:', Array.isArray(orders) ? orders.length : 'N/A');
  console.log();

  // Check each order's attachments
  (Array.isArray(orders) ? orders : []).slice(0, 5).forEach(order => {
    console.log('=== Order', order.id, order.title, '===');
    console.log('  attachments type:', typeof order.attachments);

    if (!order.attachments) {
      console.log('  NO ATTACHMENTS');
      return;
    }

    const atts = typeof order.attachments === 'string'
      ? JSON.parse(order.attachments)
      : order.attachments;

    if (!Array.isArray(atts)) {
      console.log('  attachments is not an array:', atts);
      return;
    }

    atts.forEach((a, i) => {
      console.log('  Att', i, '=> type:', a.type, '| mime:', a.mime_type);
      console.log('    has data:', !!a.data, '| has path:', !!a.path);
      if (a.data) console.log('    data preview:', a.data.substring(0, 50) + '...');
      if (a.path) console.log('    path:', a.path);
    });
    console.log();
  });
})();
