/**
 * Marcas atendidas por este backend.
 *
 * O mesmo servidor responde ao CotaJa e ao Contratae Bahia, e o pedido precisa
 * lembrar de onde veio para que comprovante e e-mail saiam com a marca certa.
 * A origem e inferida do cabecalho Origin da requisicao que cria o pedido. Os
 * aplicativos nao enviam esse cabecalho, entao caem no padrao, que e o CotaJa.
 */

const path = require('node:path');

const PADRAO = 'cotaja';

const MARCAS = {
    cotaja: {
        chave: 'cotaja',
        nome: 'CotaJá',
        site: process.env.COTAJA_SITE_URL || 'https://cotaja.io',
        logo: process.env.COTAJA_LOGO || path.join(__dirname, '../../assets/images/logo.png'),
        cor: '#4f46e5',
        corEscura: '#312e81',
        dominios: ['cotaja.io', 'www.cotaja.io', 'app.cotaja.io'],
    },
    contrataebahia: {
        chave: 'contrataebahia',
        nome: 'Contrataê Bahia',
        site: process.env.CONTRATAEBAHIA_SITE_URL || 'https://contrataebahia.com.br',
        logo: process.env.CONTRATAEBAHIA_LOGO
            || path.join(__dirname, '../../assets/images/contrataebahia-logo.png'),
        cor: '#123FAE',
        corEscura: '#071C4D',
        dominios: ['contrataebahia.com.br', 'www.contrataebahia.com.br'],
    },
};

/** Devolve a marca pela chave, caindo no padrao quando nao reconhece. */
const obter = (chave) => MARCAS[String(chave || '').toLowerCase()] || MARCAS[PADRAO];

/**
 * Descobre a marca a partir da requisicao.
 *
 * Usa Origin e, se faltar, Referer. Sem nenhum dos dois, que e o caso dos
 * aplicativos, assume o padrao.
 */
const daRequisicao = (req) => {
    const bruto = req?.headers?.origin || req?.headers?.referer || '';
    if (!bruto) return MARCAS[PADRAO];
    let host;
    try {
        host = new URL(bruto).hostname.toLowerCase();
    } catch {
        return MARCAS[PADRAO];
    }
    const achada = Object.values(MARCAS)
        .find((m) => m.dominios.some((d) => host === d || host.endsWith(`.${d}`)));
    return achada || MARCAS[PADRAO];
};

module.exports = { MARCAS, PADRAO, obter, daRequisicao };
