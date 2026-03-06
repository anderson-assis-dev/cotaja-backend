const User = require('../models/User');
const puppeteer = require('puppeteer');
const pdfParse = require('pdf-parse');
const path = require('path');
const fs = require('fs');

const PF_FORM_URL = 'https://servicos.pf.gov.br/sinic2-publico/';

class CriminalCheckService {
  static async checkProvider(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');
    if (!user.isProvider()) throw new Error('Verificação disponível apenas para prestadores');

    if (!user.name || !user.mother_name || !user.birth_date) {
      throw new Error('Dados incompletos: nome, nome da mãe e data de nascimento são obrigatórios');
    }

    const birthDate = CriminalCheckService.formatBirthDateBR(user.birth_date);

    console.log('[CriminalCheck] Iniciando verificação para:', user.name);

    const downloadDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      const client = await page.createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadDir,
      });

      console.log('[CriminalCheck] Abrindo formulário da PF...');
      await page.goto(PF_FORM_URL, { waitUntil: 'networkidle0', timeout: 60000 });
      await new Promise(r => setTimeout(r, 5000));

      console.log('[CriminalCheck] Preenchendo formulário...');

      await page.waitForSelector('input[name="nome"], input[formcontrolname="nome"], #nome', { timeout: 15000 }).catch(() => {});

      const filled = await page.evaluate((nome, nomeMae, dtNascimento) => {
        const inputs = document.querySelectorAll('input');
        let filledCount = 0;

        for (const input of inputs) {
          const name = (input.name || input.id || input.getAttribute('formcontrolname') || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();
          const label = input.closest('label')?.textContent?.toLowerCase() || '';
          const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
          const allText = name + ' ' + placeholder + ' ' + label + ' ' + ariaLabel;

          if (allText.includes('nome completo') || (allText.includes('nome') && !allText.includes('mae') && !allText.includes('mãe') && !allText.includes('pai') && !allText.includes('municipio') && !allText.includes('uf'))) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(input, nome);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
          }

          if (allText.includes('mae') || allText.includes('mãe')) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(input, nomeMae);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
          }

          if (allText.includes('nascimento') && (input.type === 'date' || allText.includes('data'))) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(input, dtNascimento);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
          }
        }

        return filledCount;
      }, user.name.toUpperCase(), (user.mother_name || '').toUpperCase(), birthDate);

      console.log('[CriminalCheck] Campos preenchidos:', filled);

      await new Promise(r => setTimeout(r, 1000));

      const submitted = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, input[type="submit"]');
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('gerar') || text.includes('emitir') || text.includes('certid') || text.includes('enviar') || text.includes('consultar')) {
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (!submitted) {
        console.log('[CriminalCheck] Botão de submit não encontrado, tentando form.submit()...');
        await page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) form.submit();
        });
      }

      console.log('[CriminalCheck] Aguardando download do PDF...');
      await new Promise(r => setTimeout(r, 15000));

      const files = fs.readdirSync(downloadDir).filter(f => f.endsWith('.pdf')).sort((a, b) => {
        return fs.statSync(path.join(downloadDir, b)).mtimeMs - fs.statSync(path.join(downloadDir, a)).mtimeMs;
      });

      await browser.close();
      browser = null;

      if (files.length === 0) {
        throw new Error('PDF não foi baixado');
      }

      const pdfPath = path.join(downloadDir, files[0]);
      const pdfBuffer = fs.readFileSync(pdfPath);
      console.log('[CriminalCheck] PDF encontrado:', files[0], '| Tamanho:', pdfBuffer.length, 'bytes');

      const pdfData = await pdfParse(pdfBuffer);
      const pdfText = pdfData.text;

      console.log('[CriminalCheck] Texto extraído:', pdfText.substring(0, 300));

      fs.unlinkSync(pdfPath);

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
