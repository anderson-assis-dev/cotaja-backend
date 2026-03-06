const User = require('../models/User');

const PF_API_URL = 'https://servicos.pf.gov.br/sinic2-publico-rest/api/cac/gerar-cac-pdf';

class CriminalCheckService {
  static async checkProvider(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');
    if (!user.isProvider()) throw new Error('Verificação disponível apenas para prestadores');

    if (!user.name || !user.mother_name || !user.birth_date) {
      throw new Error('Dados incompletos para verificação: nome, nome da mãe e data de nascimento são obrigatórios');
    }

    const birthDateFormatted = CriminalCheckService.formatBirthDateISO(user.birth_date);

    const payload = {
      cpf: null,
      nome: user.name.toUpperCase(),
      listaNacionalidade: null,
      dtNascimento: birthDateFormatted,
      coPaisNascimento: null,
      noUfNascimento: null,
      noMunicipioNascimento: null,
      ufNascimento: null,
      coMunicipioNascimento: null,
      nomePai: '',
      nomeMae: (user.mother_name || '').toUpperCase(),
      documentoCac: [],
    };

    console.log('[CriminalCheck] Consultando PF para:', user.name);

    try {
      const response = await fetch(PF_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('[CriminalCheck] Erro HTTP:', response.status);
        throw new Error(`Erro na consulta: HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const isPdf = contentType.includes('application/pdf');

      if (isPdf) {
        await user.update({
          criminal_check: 1,
          criminal_check_code: `CAC-${Date.now()}`,
          criminal_check_date: new Date(),
        });

        return {
          success: true,
          passed: true,
          code: `CAC-${Date.now()}`,
          message: 'Certidão de antecedentes criminais emitida com sucesso',
        };
      }

      const data = await response.json();

      console.log('[CriminalCheck] Resposta:', JSON.stringify(data));

      const passed = !data.erro && !data.mensagemErro;

      await user.update({
        criminal_check: passed ? 1 : 0,
        criminal_check_code: data.codigo || data.numero || null,
        criminal_check_date: new Date(),
      });

      return {
        success: passed,
        passed,
        code: data.codigo || data.numero || null,
        message: data.mensagem || data.mensagemErro || (passed ? 'Certidão emitida com sucesso' : 'Não foi possível emitir certidão'),
      };
    } catch (error) {
      console.error('[CriminalCheck] Erro na consulta:', error.message);

      await user.update({
        criminal_check: 0,
        criminal_check_code: null,
        criminal_check_date: new Date(),
      });

      return {
        success: false,
        passed: false,
        code: null,
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
