const User = require('../models/User');
const { connect } = require('puppeteer-real-browser');
const pdfParse = require('pdf-parse');
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

class CriminalCheckService {
  static async checkProvider(userId) {
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

    if (!user.name || !user.mother_name || !user.birth_date) {
      throw new Error('Dados incompletos: nome, nome da mãe e data de nascimento são obrigatórios');
    }

    const birthDateBR = CriminalCheckService.formatBirthDateBR(user.birth_date);

    console.log('[CriminalCheck] Iniciando verificação para:', user.name);

    let browser;
    try {
      const chromePath = process.env.CHROME_PATH || null;
      const isLinux = process.platform === 'linux';

      if (!isLinux) {
        try {
          execSync('pkill -f "Brave Browser"', { stdio: 'ignore' });
          await new Promise(r => setTimeout(r, 2000));
        } catch {}
      }

      const connectOpts = {
        headless: isLinux ? true : false,
        turnstile: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
      };
      if (chromePath) {
        connectOpts.customConfig = { chromePath };
      }

      const conn = await connect(connectOpts);
      browser = conn.browser;
      const page = conn.page;

      await page.setViewport({ width: 1920, height: 1080 });

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

      console.log('[CriminalCheck] Aguardando PDF download...');
      let pdfFilePath = null;
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 2500));
        const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith('.pdf') || f.endsWith('CAC'));
        if (files.length > 0) {
          pdfFilePath = path.join(DOWNLOAD_DIR, files[0]);
          break;
        }
      }

      await browser.close();
      browser = null;

      if (!pdfFilePath) {
        throw new Error('PDF não foi baixado após emitir CAC');
      }

      const pdfBuffer = fs.readFileSync(pdfFilePath);
      console.log('[CriminalCheck] PDF baixado:', pdfBuffer.length, 'bytes');

      try { fs.unlinkSync(pdfFilePath); } catch {}

      const pdfData = await pdfParse(pdfBuffer);
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
      if (browser) await browser.close().catch(() => {});
      console.error('[CriminalCheck] Erro:', error.message);

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
