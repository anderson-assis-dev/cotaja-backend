const ReceiptService = require('../services/ReceiptService');
const Order = require('../models/Order');

class ReceiptController {
    /**
     * Comprovante do pedido, para o cliente ou o prestador envolvidos.
     * Traz o endereco completo, porque as duas partes ja o conhecem.
     */
    async doPedido(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
            }
            if (order.client_id !== user.id && order.provider_id !== user.id) {
                return res.status(403).json({ success: false, message: 'Você não participou deste serviço.' });
            }
            if (order.status !== Order.STATUS_COMPLETED) {
                return res.status(400).json({
                    success: false,
                    message: 'O comprovante fica disponível quando o serviço é concluído.',
                });
            }

            // emite na primeira consulta, para pedidos concluidos antes desta funcionalidade
            await ReceiptService.emitir(order.id);

            const row = await ReceiptService.porPedido(order.id);
            return res.json({ success: true, data: ReceiptService.montar(row, { publico: false }) });
        } catch (error) {
            console.error('Erro ao gerar comprovante:', error);
            return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
        }
    }

    /**
     * Conferencia publica pelo codigo, sem necessidade de conta.
     * Omite a descricao e o endereco exato, porque o link pode circular.
     */
    async porCodigo(req, res) {
        try {
            const { codigo } = req.params;
            if (!codigo || codigo.length < 6) {
                return res.status(400).json({ success: false, message: 'Código inválido.' });
            }

            const row = await ReceiptService.porCodigo(codigo);
            if (!row) {
                return res.status(404).json({
                    success: false,
                    message: 'Não encontramos nenhum comprovante com esse código.',
                });
            }

            return res.json({ success: true, data: ReceiptService.montar(row, { publico: true }) });
        } catch (error) {
            console.error('Erro ao conferir comprovante:', error);
            return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
        }
    }
}

module.exports = new ReceiptController();
