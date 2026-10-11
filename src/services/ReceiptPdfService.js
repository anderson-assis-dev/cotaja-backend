const fs = require('node:fs');
const path = require('node:path');

const BRAND = process.env.RECEIPT_BRAND_NAME || 'Contrataê Bahia';
const SITE = (process.env.RECEIPT_SITE_URL || 'https://contrataebahia.com.br').replace(/\/$/, '');
const AZUL = '#123FAE';
const AZUL_ESCURO = '#071C4D';

const escapar = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const dataHora = (v) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia',
    });
};

const moeda = (v) => (v == null ? null : Number(v).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
}));

// O backend atende mais de uma marca, entao o logo do comprovante acompanha
// a marca configurada em vez de usar o logo fixo dos e-mails.
const LOGO = process.env.RECEIPT_LOGO
    || path.join(__dirname, '../../assets/images/contrataebahia-logo.png');

let logoCache;
const logoDataUri = () => {
    if (logoCache !== undefined) return logoCache;
    try {
        logoCache = `data:image/png;base64,${fs.readFileSync(LOGO).toString('base64')}`;
    } catch {
        logoCache = null;
    }
    return logoCache;
};

/** HTML do comprovante, autocontido: sem fonte externa nem imagem remota. */
const montarHtml = (r) => {
    const linha = (rotulo, valor) => (valor
        ? `<tr><th>${escapar(rotulo)}</th><td>${valor}</td></tr>`
        : '');

    const selo = r.profissional?.verificado
        ? '<span class="selo">Verificado</span>'
        : '';

    const chegada = r.chegada_validada_por_gps ? `
        <div class="chegada">
            <strong>Chegada confirmada no local</strong><br>
            ${escapar(dataHora(r.datas?.chegada_confirmada_em))}
            ${r.distancia_na_confirmacao_km != null
                ? `, a ${String(r.distancia_na_confirmacao_km).replace('.', ',')} km do endereço`
                : ''}.
            Validada por código pessoal do profissional e por proximidade de GPS.
        </div>` : '';

    const logo = logoDataUri();

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Helvetica, Arial, sans-serif; color:#101B33; font-size:11pt; }
  .topo { display:flex; align-items:flex-start; justify-content:space-between;
          border-bottom:1px solid #E3E8F2; padding-bottom:14px; }
  .topo img { height:40px; }
  .topo .marca { font-size:15pt; font-weight:bold; color:${AZUL}; }
  .tipo { text-align:right; }
  .tipo span { display:block; font-size:8pt; letter-spacing:1.4px; text-transform:uppercase; color:#5A6480; }
  .tipo strong { display:block; font-size:14pt; color:${AZUL}; letter-spacing:1px; margin-top:2px; }
  h1 { font-size:17pt; margin:22px 0 2px; line-height:1.25; }
  .cat { color:#5A6480; font-size:10pt; margin:0; }
  .chegada { margin:18px 0 0; padding:12px 14px; background:#EEF3FD;
             border-left:4px solid ${AZUL}; border-radius:4px;
             font-size:10pt; line-height:1.5; color:${AZUL_ESCURO}; }
  table { width:100%; border-collapse:collapse; margin-top:20px; }
  th, td { text-align:left; padding:8px 0; border-bottom:1px solid #E3E8F2;
           font-size:10.5pt; vertical-align:top; }
  th { width:34%; color:#5A6480; font-weight:normal; }
  td { font-weight:bold; }
  .selo { display:inline-block; margin-left:7px; padding:1px 7px; border-radius:9px;
          background:#DCE4F8; color:${AZUL_ESCURO}; font-size:8pt; font-weight:bold; }
  .desc { margin-top:20px; }
  .desc span { display:block; font-size:8pt; letter-spacing:1.2px;
               text-transform:uppercase; color:#5A6480; margin-bottom:5px; }
  .desc p { margin:0; font-size:10.5pt; line-height:1.6; color:#33405C; }
  .rodape { margin-top:26px; padding-top:12px; border-top:1px solid #E3E8F2;
            color:#5A6480; font-size:8.5pt; line-height:1.6; }
</style></head><body>
  <div class="topo">
    ${logo ? `<img src="${logo}" alt="">` : `<div class="marca">${escapar(BRAND)}</div>`}
    <div class="tipo">
      <span>Comprovante de serviço</span>
      <strong>${escapar(r.codigo)}</strong>
    </div>
  </div>

  <h1>${escapar(r.servico?.titulo)}</h1>
  <p class="cat">${escapar(r.servico?.categoria)}</p>
  ${chegada}

  <table>
    ${linha('Contratante', escapar(r.cliente?.nome))}
    ${linha('Profissional', `${escapar(r.profissional?.nome)}${selo}`)}
    ${linha('Local', escapar(r.local))}
    ${linha('Valor acordado', escapar(moeda(r.valor)))}
    ${linha('Prazo acordado', r.prazo_dias ? `${r.prazo_dias} dias` : '')}
    ${linha('Pedido publicado em', escapar(dataHora(r.datas?.pedido_em)))}
    ${linha('Agendado para', escapar(dataHora(r.datas?.agendado_para)))}
    ${linha('Concluído em', escapar(dataHora(r.datas?.concluido_em)))}
  </table>

  ${r.servico?.descricao ? `<div class="desc"><span>Descrição do serviço</span><p>${escapar(r.servico.descricao)}</p></div>` : ''}

  <div class="rodape">
    Emitido em ${escapar(dataHora(r.emitido_em))} por ${escapar(BRAND)}.<br>
    Confira a autenticidade deste comprovante em ${SITE}/comprovante/${escapar(r.codigo)}
  </div>
</body></html>`;
};

/**
 * Gera o PDF do comprovante.
 *
 * Devolve null em caso de falha, em vez de lançar: um problema ao abrir o
 * navegador nao pode impedir que o e-mail de conclusao seja enviado.
 */
const CAMINHOS_CHROME = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/**
 * Acha um Chrome utilizavel.
 *
 * Em producao o servidor ja tem Chrome instalado para a checagem de
 * antecedentes, entao vale aproveitar em vez de depender do download do
 * Puppeteer, que nem sempre acontece no deploy.
 */
const acharChrome = (puppeteer) => {
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        return process.env.CHROME_PATH;
    }
    try {
        const padrao = puppeteer.executablePath();
        if (padrao && fs.existsSync(padrao)) return padrao;
    } catch { /* sem Chromium baixado */ }
    return CAMINHOS_CHROME.find((c) => fs.existsSync(c)) || undefined;
};

const gerarPdf = async (comprovante) => {
    let browser = null;
    try {
        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: acharChrome(puppeteer),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
                '--disable-dev-shm-usage', '--js-flags=--max-old-space-size=256'],
        });
        const page = await browser.newPage();
        await page.setContent(montarHtml(comprovante), { waitUntil: 'load', timeout: 20000 });
        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    } catch (error) {
        console.error('Não foi possível gerar o PDF do comprovante:', error.message);
        return null;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
};

module.exports = { gerarPdf, montarHtml, BRAND, SITE };
