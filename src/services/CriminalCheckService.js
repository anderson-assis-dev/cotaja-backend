const User = require('../models/User');
const { connect } = require('puppeteer-real-browser');
const { PDFParse } = require('pdf-parse');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const PF_FORM_URL = 'https://servicos.pf.gov.br/epol-sinic-publico/';
const DOWNLOAD_DIR = '/tmp/pf-downloads';

const SELECTORS = {
  nome: '#p-card-dados-gerais > div > div > div > div:nth-child(3) > div:nth-child(2) > input:nth-child(3)',
  cpf: '#p-card-dados-gerais > div > div > div > div:nth-child(3) > div:nth-child(1) > pf-input-cpf > span > p-inputmask > input',
  birthDate: '#p-card-dados-gerais > div > div > div > div:nth-child(4) > div:nth-child(1) > pf-calendar > span > input',
  motherName: '#p-card-dados-gerais > div > div > div > div:nth-child(5) > div:nth-child(3) > input',
  nacionalidade: '#p-card-dados-gerais > div > div > div > div:nth-child(3) > div:nth-child(3) > multiselect-pais > div > p-multiselect',
  btnEmitir: '#btn-emitir-cac',
};

const CRIMINAL_CHECK_TIMEOUT_MS = 3 * 60 * 1000;

class CriminalCheckService {
  static async checkProvider(userId) {
    let browserRef = { browser: null };
    const timeout = new Promise((_, reject) => {
      setTimeout(() => {
        if (browserRef.browser) {
          console.error('[CriminalCheck] TIMEOUT — forçando fechamento do browser');
          browserRef.browser.close().catch(() => {});
          browserRef.browser = null;
        }
        reject(new Error('CriminalCheck timeout após 3 minutos'));
      }, CRIMINAL_CHECK_TIMEOUT_MS);
    });
    return Promise.race([CriminalCheckService._doCheck(userId, browserRef), timeout]);
  }

  static async _doCheck(userId, browserRef) {
    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');
    if (!user.isProvider()) throw new Error('Verificação disponível apenas para prestadores');

    const cpfDigits = (user.cpf || '').replace(/\D/g, '');
    if (cpfDigits.length > 11) {
      console.log('[CriminalCheck] CNPJ detectado, pulando verificação criminal para:', user.name);
      await user.update({
        criminal_check: 1,
        criminal_check_code: 'CNPJ_ISENTO',
        criminal_check_date: new Date(),
      });
      return {
        success: true,
        passed: true,
        code: null,
        criminal_check_code: 'CNPJ_ISENTO',
        message: 'CNPJ isento de verificação criminal',
      };
    }

    if (!user.name || !user.cpf || !user.mother_name || !user.birth_date) {
      throw new Error('Dados incompletos: nome, CPF, nome da mãe e data de nascimento são obrigatórios');
    }

    const birthDate = new Date(user.birth_date);
    const ageDiffMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiffMs);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    if (age >= 50) {
      console.log(`[CriminalCheck] Usuário ${user.name} tem ${age} anos (>=50), pulando verificação`);
      await user.update({
        criminal_check: 1,
        criminal_check_code: 'IDADE_INCOMPATIVEL',
        criminal_check_date: new Date(),
      });
      return {
        success: true,
        passed: true,
        code: null,
        criminal_check_code: 'IDADE_INCOMPATIVEL',
        message: 'Usuário com 50+ anos - verificação não disponível no site da Receita Federal',
      };
    }

    const birthDateBR = CriminalCheckService.formatBirthDateBR(user.birth_date);

    console.log('[CriminalCheck] Iniciando verificação para:', user.name);

    let browser;
    try {
      const chromePath = process.env.CHROME_PATH || null;
      const isLinux = process.platform === 'linux';

      try {
        if (isLinux) {
          execSync('pkill -f chrome', { stdio: 'ignore' });
        } else {
          execSync('pkill -f "Brave Browser"', { stdio: 'ignore' });
        }
        await new Promise(r => setTimeout(r, 2000));
      } catch {}

      const connectOpts = {
        headless: false,
        turnstile: true,
        disableXvfb: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-component-extensions-with-background-pages',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-hang-monitor',
          '--disable-renderer-backgrounding',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--window-size=1280,720',
          '--js-flags=--max-old-space-size=256',
        ],
      };
      if (chromePath) {
        connectOpts.customConfig = { chromePath };
      }

      const conn = await connect(connectOpts);
      browser = conn.browser;
      if (browserRef) browserRef.browser = browser;
      const page = conn.page;

      await page.setViewport({ width: 1280, height: 720 });

      if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
      const existingFiles = fs.readdirSync(DOWNLOAD_DIR);
      existingFiles.forEach(f => fs.unlinkSync(path.join(DOWNLOAD_DIR, f)));

      const client = await page.createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: DOWNLOAD_DIR,
      });

      console.log('[CriminalCheck] Abrindo site da PF...');
      await page.goto(PF_FORM_URL, { waitUntil: 'networkidle2', timeout: 90000 });

      console.log('[CriminalCheck] Aguardando Cloudflare resolver...');
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const hasForm = await page.$(SELECTORS.nome);
        const title = await page.title();
        console.log(`[CriminalCheck] ${(i + 1) * 5}s - Titulo: "${title}" | Formulário: ${!!hasForm}`);
        if (hasForm) {
          console.log('[CriminalCheck] Formulário encontrado!');
          break;
        }
      }

      const hasForm = await page.$(SELECTORS.nome);
      if (!hasForm) {
        throw new Error('Formulário da PF não carregou após bypass do Cloudflare');
      }

      console.log('[CriminalCheck] Removendo multiselect de Nacionalidade...');
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.remove();
      }, SELECTORS.nacionalidade);
      await new Promise(r => setTimeout(r, 2000));

      console.log('[CriminalCheck] Preenchendo Nome Completo...');
      await CriminalCheckService.fillField(page, SELECTORS.nome, user.name.toUpperCase());

      console.log('[CriminalCheck] Preenchendo Data de Nascimento...');
      await CriminalCheckService.fillField(page, SELECTORS.birthDate, birthDateBR);

      console.log('[CriminalCheck] Preenchendo Nome da Mãe...');
      await CriminalCheckService.fillField(page, SELECTORS.motherName, (user.mother_name || '').toUpperCase());

      await new Promise(r => setTimeout(r, 1000));

      let pdfBuffer = null;
      const pdfResponsePromise = new Promise((resolve) => {
        page.on('response', async (response) => {
          try {
            const ct = response.headers()['content-type'] || '';
            const url = response.url();
            if (ct.includes('application/pdf') || url.endsWith('.pdf')) {
              const buffer = await response.buffer();
              if (buffer && buffer.length > 500) {
                console.log(`[CriminalCheck] PDF interceptado via rede (${buffer.length} bytes, url: ${url})`);
                resolve(buffer);
              }
            }
          } catch {}
        });
      });

      const newPagePdfPromise = new Promise((resolve) => {
        browser.on('targetcreated', async (target) => {
          if (target.type() === 'page') {
            try {
              const newPage = await target.page();
              console.log('[CriminalCheck] Nova aba detectada:', newPage.url());
              newPage.on('response', async (response) => {
                try {
                  const ct = response.headers()['content-type'] || '';
                  if (ct.includes('application/pdf')) {
                    const buffer = await response.buffer();
                    if (buffer && buffer.length > 500) {
                      console.log(`[CriminalCheck] PDF interceptado via nova aba (${buffer.length} bytes)`);
                      resolve(buffer);
                    }
                  }
                } catch {}
              });
            } catch {}
          }
        });
      });

      console.log('[CriminalCheck] Clicando em Emitir CAC...');
      const btn = await page.$(SELECTORS.btnEmitir);
      if (btn) {
        await btn.click();
      } else {
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const b of btns) {
            if (b.textContent?.toLowerCase().includes('emitir')) { b.click(); return; }
          }
        });
      }

      await new Promise(r => setTimeout(r, 3000));

      const rateLimited = await page.evaluate(() => {
        const body = document.body?.innerText || '';
        return body.includes('excedeu o limite') || body.includes('limite máximo de tentativas');
      });

      if (rateLimited) {
        console.error('[CriminalCheck] RATE LIMITED — site da PF bloqueou por excesso de tentativas');
        await browser.close().catch(() => {});
        browser = null;
        if (browserRef) browserRef.browser = null;
        const err = new Error('RATE_LIMITED: Limite de tentativas excedido no site da PF');
        err.code = 'RATE_LIMITED';
        throw err;
      }

      console.log('[CriminalCheck] Aguardando PDF (rede + download)...');

      const networkPdf = await Promise.race([
        pdfResponsePromise,
        newPagePdfPromise,
        new Promise(resolve => setTimeout(() => resolve(null), 30000)),
      ]);

      if (networkPdf) {
        pdfBuffer = networkPdf;
      }

      if (!pdfBuffer) {
        const pageBodyText = await page.evaluate(() => document.body?.innerText || '');
        const isRequerimento = pageBodyText.includes('Não foi possível emitir') || pageBodyText.includes('Nao foi possivel emitir');

        if (isRequerimento) {
          const protocolMatch = pageBodyText.match(/protocolo[:\s]+(\d+)/i);
          const protocolNumber = protocolMatch ? protocolMatch[1] : null;
          console.log(`[CriminalCheck] Caso REQUERIMENTO detectado. Protocolo: ${protocolNumber}`);

          const clicked = await page.evaluate(() => {
            const elements = document.querySelectorAll('button, a, span');
            for (const el of elements) {
              const text = el.textContent?.toLowerCase() || '';
              if (text.includes('realizar download') || text.includes('requerimento de certidão')) {
                el.click();
                return true;
              }
            }
            return false;
          });

          if (clicked) {
            console.log('[CriminalCheck] Clicando no download do Requerimento, aguardando arquivo...');
            for (let i = 0; i < 8; i++) {
              await new Promise(r => setTimeout(r, 2500));
              const files = fs.readdirSync(DOWNLOAD_DIR).filter(f =>
                f.endsWith('.pdf') || (!f.endsWith('.crdownload') && !f.endsWith('.tmp') && f.length > 5)
              );
              if (files.length > 0) {
                const filePath = path.join(DOWNLOAD_DIR, files[0]);
                console.log(`[CriminalCheck] Requerimento PDF: ${files[0]} (${fs.statSync(filePath).size} bytes)`);
                try { fs.unlinkSync(filePath); } catch {}
                break;
              }
            }
          }

          await browser.close().catch(() => {});
          browser = null;
          if (browserRef) browserRef.browser = null;

          console.log('[CriminalCheck] Marcando como REQUERIMENTO (verificação presencial necessária)');
          await user.update({
            criminal_check: 1,
            criminal_check_code: 'REQUERIMENTO',
            criminal_check_date: new Date(),
          });

          return {
            success: true,
            passed: false,
            code: protocolNumber,
            criminal_check_code: 'REQUERIMENTO',
            message: `Verificação presencial na PF necessária. Protocolo: ${protocolNumber || 'N/A'}`,
          };
        }

        console.log('[CriminalCheck] PDF não veio via rede, tentando diretório de download...');
        for (let i = 0; i < 12; i++) {
          await new Promise(r => setTimeout(r, 2500));
          const files = fs.readdirSync(DOWNLOAD_DIR).filter(f =>
            f.endsWith('.pdf') || f.endsWith('CAC') || (!f.endsWith('.crdownload') && !f.endsWith('.tmp') && f.length > 5)
          );
          if (files.length > 0) {
            const filePath = path.join(DOWNLOAD_DIR, files[0]);
            pdfBuffer = fs.readFileSync(filePath);
            console.log(`[CriminalCheck] PDF encontrado em disco: ${files[0]} (${pdfBuffer.length} bytes)`);
            try { fs.unlinkSync(filePath); } catch {}
            break;
          }
        }
      }

      if (!pdfBuffer) {
        const pageContent = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
        const pageUrl = page.url();
        console.error(`[CriminalCheck] FALHA DOWNLOAD — URL: ${pageUrl}`);
        console.error(`[CriminalCheck] FALHA DOWNLOAD — Conteúdo da página: ${pageContent}`);
        const screenshotPath = `/tmp/criminal-check-fail-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
        console.error(`[CriminalCheck] Screenshot salvo em: ${screenshotPath}`);
      }

      await browser.close().catch(() => {});
      browser = null;
      if (browserRef) browserRef.browser = null;

      if (!pdfBuffer) {
        throw new Error('PDF não foi baixado após emitir CAC');
      }

      console.log('[CriminalCheck] PDF capturado:', pdfBuffer.length, 'bytes');

      const parser = new PDFParse({ data: pdfBuffer });
      const pdfData = await parser.getText();
      const pdfText = pdfData.text;

      console.log('[CriminalCheck] Texto extraído do PDF:', pdfText.substring(0, 400));

      const naoConsta = pdfText.toUpperCase().includes('NÃO CONSTA');

      const certMatch = pdfText.match(/N[°º]\s*(\d+)/);
      const certNumber = certMatch ? certMatch[1] : null;

      await user.update({
        criminal_check: 1,
        criminal_check_code: naoConsta ? 'NAO_CONSTA' : 'CONSTA',
        criminal_check_date: new Date(),
      });

      console.log('[CriminalCheck] Resultado:', naoConsta ? 'NÃO CONSTA' : 'CONSTA', '| Certidão:', certNumber);

      return {
        success: true,
        passed: naoConsta,
        code: certNumber,
        criminal_check_code: naoConsta ? 'NAO_CONSTA' : 'CONSTA',
        message: naoConsta ? 'Não consta condenação criminal' : 'Consta condenação criminal',
      };
    } catch (error) {
      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
        if (browserRef) browserRef.browser = null;
      }
      console.error('[CriminalCheck] Erro:', error.message, error.stack);

      await user.update({
        criminal_check: 0,
        criminal_check_code: null,
        criminal_check_date: new Date(),
      });

      return {
        success: false,
        passed: false,
        code: null,
        criminal_check_code: null,
        message: error.message || 'Erro ao consultar antecedentes criminais',
      };
    }
  }

  static async fillField(page, selector, text) {
    const el = await page.$(selector);
    if (!el) return;
    await el.click();
    await new Promise(r => setTimeout(r, 300));
    await el.click({ clickCount: 3 });
    await new Promise(r => setTimeout(r, 100));
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 200));
    for (const char of text) {
      await page.keyboard.type(char, { delay: 50 + Math.random() * 60 });
      await new Promise(r => setTimeout(r, 30));
    }
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate((sel) => {
      const input = document.querySelector(sel);
      if (input) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, selector);
    await new Promise(r => setTimeout(r, 500));
  }

  static formatBirthDateBR(dateValue) {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

module.exports = CriminalCheckService;
