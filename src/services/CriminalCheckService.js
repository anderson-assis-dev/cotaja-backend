const User = require('../models/User');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const pdfParse = require('pdf-parse');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const PF_FORM_URL = 'https://servicos.pf.gov.br/sinic2-publico/';
const PF_API_URL = 'https://servicos.pf.gov.br/sinic2-publico-rest/api/cac/gerar-cac-pdf';

class CriminalCheckService {
  static async checkProvider(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');
    if (!user.isProvider()) throw new Error('Verificação disponível apenas para prestadores');

    if (!user.name || !user.mother_name || !user.birth_date) {
      throw new Error('Dados incompletos: nome, nome da mãe e data de nascimento são obrigatórios');
    }

    const birthDateISO = CriminalCheckService.formatBirthDateISO(user.birth_date);

    const payload = {
      cpf: null,
      nome: user.name.toUpperCase(),
      listaNacionalidade: null,
      dtNascimento: birthDateISO,
      coPaisNascimento: null,
      noUfNascimento: null,
      noMunicipioNascimento: null,
      ufNascimento: null,
      coMunicipioNascimento: null,
      nomePai: '',
      nomeMae: (user.mother_name || '').toUpperCase(),
      documentoCac: [],
    };

    console.log('[CriminalCheck] Iniciando verificação para:', user.name);

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=1920,1080',
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      });

      console.log('[CriminalCheck] Abrindo site da PF (stealth mode)...');
      await page.goto(PF_FORM_URL, { waitUntil: 'networkidle2', timeout: 90000 });

      console.log('[CriminalCheck] Aguardando Cloudflare...');
      await new Promise(r => setTimeout(r, 15000));

      const currentUrl = page.url();
      console.log('[CriminalCheck] URL atual:', currentUrl);

      const pageTitle = await page.title();
      console.log('[CriminalCheck] Titulo da página:', pageTitle);

      if (pageTitle.includes('moment') || pageTitle.includes('Cloudflare')) {
        console.log('[CriminalCheck] Cloudflare detectado, aguardando mais 20s...');
        await new Promise(r => setTimeout(r, 20000));
      }

      console.log('[CriminalCheck] Fazendo POST via fetch no contexto do navegador...');
      const pdfBytes = await page.evaluate(async (apiUrl, body) => {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/pdf, application/json',
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} - ${text.substring(0, 200)}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        return Array.from(new Uint8Array(arrayBuffer));
      }, PF_API_URL, payload);

      await browser.close();
      browser = null;

      const pdfBuffer = Buffer.from(pdfBytes);
      console.log('[CriminalCheck] Resposta recebida, tamanho:', pdfBuffer.length, 'bytes');

      if (pdfBuffer.length < 100) {
        const text = pdfBuffer.toString('utf-8');
        console.log('[CriminalCheck] Resposta pequena:', text);
        throw new Error('Resposta inválida da PF: ' + text.substring(0, 200));
      }

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

  static formatBirthDateISO(dateValue) {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

module.exports = CriminalCheckService;
