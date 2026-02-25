const appleMapsService = require('../services/AppleMapsService');

class GeocodingController {
    /**
     * GET /api/geocoding/token
     * Returns a MapKit JS token for the frontend WebView
     */
    async getMapKitToken(req, res) {
        try {
            const token = appleMapsService.generateMapKitToken();
            return res.json({
                success: true,
                data: { token }
            });
        } catch (error) {
            console.error('Erro ao gerar token MapKit:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao gerar token do mapa'
            });
        }
    }

    /**
     * GET /api/geocoding/reverse?lat=XX&lng=XX
     * Reverse geocode: coordenadas → endereço
     */
    async reverseGeocode(req, res) {
        try {
            const { lat, lng } = req.query;

            if (!lat || !lng) {
                return res.status(400).json({
                    success: false,
                    message: 'Latitude e longitude são obrigatórios'
                });
            }

            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);

            if (isNaN(latitude) || isNaN(longitude)) {
                return res.status(400).json({
                    success: false,
                    message: 'Latitude e longitude devem ser números válidos'
                });
            }

            const address = await appleMapsService.reverseGeocode(latitude, longitude);

            if (!address) {
                return res.status(404).json({
                    success: false,
                    message: 'Nenhum endereço encontrado para essas coordenadas'
                });
            }

            return res.json({
                success: true,
                data: address
            });
        } catch (error) {
            console.error('Erro no reverse geocode:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao converter coordenadas em endereço'
            });
        }
    }

    /**
     * GET /api/geocoding/forward?address=XXX
     * Forward geocode: endereço → coordenadas
     */
    async forwardGeocode(req, res) {
        try {
            const { address } = req.query;

            if (!address) {
                return res.status(400).json({
                    success: false,
                    message: 'Endereço é obrigatório'
                });
            }

            const result = await appleMapsService.forwardGeocode(address);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: 'Nenhum resultado encontrado para esse endereço'
                });
            }

            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Erro no forward geocode:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao converter endereço em coordenadas'
            });
        }
    }

    /**
     * GET /api/geocoding/search?q=XXX&lat=XX&lng=XX
     * Buscar endereços (autocomplete)
     */
    async search(req, res) {
        try {
            const { q, lat, lng } = req.query;

            if (!q) {
                return res.status(400).json({
                    success: false,
                    message: 'Query de busca é obrigatória'
                });
            }

            const latitude = lat ? parseFloat(lat) : null;
            const longitude = lng ? parseFloat(lng) : null;

            const results = await appleMapsService.searchAddress(q, latitude, longitude);

            return res.json({
                success: true,
                data: results
            });
        } catch (error) {
            console.error('Erro na busca de endereço:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar endereço'
            });
        }
    }

    /**
     * GET /api/geocoding/cep/:cep
     * Consultar CEP via ViaCEP
     */
    async lookupCep(req, res) {
        try {
            const { cep } = req.params;

            if (!cep) {
                return res.status(400).json({
                    success: false,
                    message: 'CEP é obrigatório'
                });
            }

            const cleanCep = cep.replace(/[^0-9]/g, '');

            if (cleanCep.length !== 8) {
                return res.status(400).json({
                    success: false,
                    message: 'CEP deve ter 8 dígitos'
                });
            }

            const address = await appleMapsService.lookupCep(cleanCep);

            if (!address) {
                return res.status(404).json({
                    success: false,
                    message: 'CEP não encontrado'
                });
            }

            return res.json({
                success: true,
                data: address
            });
        } catch (error) {
            console.error('Erro na consulta de CEP:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao consultar CEP'
            });
        }
    }
}

module.exports = new GeocodingController();
