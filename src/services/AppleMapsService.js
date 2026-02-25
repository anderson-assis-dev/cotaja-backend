const jwt = require('jsonwebtoken');
const fs = require('fs');
const appleMapsConfig = require('../config/appleMaps');

class AppleMapsService {
    constructor() {
        this._token = null;
        this._tokenExpiry = null;
        this._accessToken = null;
        this._accessTokenExpiry = null;
    }

    /**
     * Generate a MapKit JS JWT token (used by frontend WebView for displaying maps)
     */
    generateMapKitToken() {
        const now = Math.floor(Date.now() / 1000);

        // Return cached token if still valid (5 min buffer)
        if (this._token && this._tokenExpiry && (this._tokenExpiry - now) > 300) {
            return this._token;
        }

        const privateKey = fs.readFileSync(appleMapsConfig.privateKeyPath, 'utf8');

        const payload = {
            iss: appleMapsConfig.teamId,
            sub: appleMapsConfig.mapsId,
            iat: now,
            exp: now + appleMapsConfig.tokenExpirySeconds,
        };

        this._token = jwt.sign(payload, privateKey, {
            algorithm: 'ES256',
            keyid: appleMapsConfig.keyId,
        });
        this._tokenExpiry = now + appleMapsConfig.tokenExpirySeconds;

        console.log('🗺️ MapKit JS token gerado com sucesso');
        return this._token;
    }

    /**
     * Get an access token from Apple Maps Server API
     * This token is used for server-side geocoding requests
     */
    async getAccessToken() {
        const now = Math.floor(Date.now() / 1000);

        // Return cached access token if still valid (5 min buffer)
        if (this._accessToken && this._accessTokenExpiry && (this._accessTokenExpiry - now) > 300) {
            return this._accessToken;
        }

        try {
            const mapkitToken = this.generateMapKitToken();

            const response = await fetch(`${appleMapsConfig.serverApiBaseUrl}/v1/token`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${mapkitToken}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Apple Maps token response:', response.status, errorText);
                throw new Error(`Apple Maps token error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            this._accessToken = data.accessToken;
            // Apple tokens last ~30 min, but we refresh earlier
            this._accessTokenExpiry = now + 1500; // 25 minutes

            console.log('🗺️ Apple Maps access token obtido com sucesso');
            return this._accessToken;
        } catch (error) {
            console.error('❌ Erro ao obter access token Apple Maps:', error.message);
            throw error;
        }
    }

    /**
     * Reverse Geocode: Convert latitude/longitude to address
     * @param {number} latitude
     * @param {number} longitude
     * @returns {Object} Structured address
     */
    async reverseGeocode(latitude, longitude) {
        try {
            const accessToken = await this.getAccessToken();

            const url = `${appleMapsConfig.serverApiBaseUrl}/v1/reverseGeocode?loc=${latitude},${longitude}&lang=pt-BR`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Reverse geocode error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                return null;
            }

            const result = data.results[0];
            return this._parseAppleAddress(result);
        } catch (error) {
            console.error('❌ Erro no reverse geocode:', error.message);
            throw error;
        }
    }

    /**
     * Forward Geocode (Search): Convert address text to coordinates
     * @param {string} addressText - Full address or partial search
     * @returns {Object} Coordinates and structured address
     */
    async forwardGeocode(addressText) {
        try {
            const accessToken = await this.getAccessToken();

            const url = `${appleMapsConfig.serverApiBaseUrl}/v1/geocode?q=${encodeURIComponent(addressText)}&lang=pt-BR&limitToCountries=BR`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Forward geocode error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                return null;
            }

            const result = data.results[0];
            return this._parseAppleAddress(result);
        } catch (error) {
            console.error('❌ Erro no forward geocode:', error.message);
            throw error;
        }
    }

    /**
     * Search for addresses (autocomplete-like)
     * @param {string} query - Search query
     * @param {number} latitude - Optional: user latitude for biasing results
     * @param {number} longitude - Optional: user longitude for biasing results
     * @returns {Array} List of matching addresses
     */
    async searchAddress(query, latitude = null, longitude = null) {
        try {
            const accessToken = await this.getAccessToken();

            let url = `${appleMapsConfig.serverApiBaseUrl}/v1/search?q=${encodeURIComponent(query)}&lang=pt-BR&limitToCountries=BR`;

            if (latitude && longitude) {
                url += `&searchLocation=${latitude},${longitude}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Search error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                return [];
            }

            return data.results.map(result => this._parseAppleAddress(result)).filter(Boolean);
        } catch (error) {
            console.error('❌ Erro na busca de endereço:', error.message);
            throw error;
        }
    }

    /**
     * Consultar CEP via ViaCEP (API gratuita brasileira)
     * @param {string} cep - CEP no formato XXXXX-XXX ou XXXXXXXX
     * @returns {Object} Endereço estruturado
     */
    async lookupCep(cep) {
        try {
            const cleanCep = cep.replace(/[^0-9]/g, '');

            if (cleanCep.length !== 8) {
                throw new Error('CEP deve ter 8 dígitos');
            }

            const url = `https://viacep.com.br/ws/${cleanCep}/json/`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`ViaCEP error (${response.status})`);
            }

            const data = await response.json();

            if (data.erro) {
                return null;
            }

            console.log('📮 CEP encontrado:', cleanCep, '->', data.logradouro, data.localidade);

            return {
                street: data.logradouro || '',
                number: '',
                complement: data.complemento || '',
                neighborhood: data.bairro || '',
                city: data.localidade || '',
                state: data.uf || '',
                zip_code: `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`,
                latitude: null,
                longitude: null,
                formatted_address: `${data.logradouro || ''}, ${data.bairro || ''}, ${data.localidade || ''} - ${data.uf || ''}, ${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`,
                name: data.logradouro || '',
            };
        } catch (error) {
            console.error('❌ Erro na consulta de CEP:', error.message);
            throw error;
        }
    }

    /**
     * Parse Apple Maps response into our structured address format
     */
    _parseAppleAddress(result) {
        if (!result) return null;

        const loc = result.coordinate || result.center || {};
        const addr = result.structuredAddress || {};

        // Build formatted full address
        const parts = [];
        if (addr.thoroughfare) parts.push(addr.thoroughfare);
        if (addr.subThoroughfare) parts.push(addr.subThoroughfare);
        if (addr.locality) parts.push(addr.locality);
        if (addr.administrativeArea) parts.push(addr.administrativeArea);
        if (addr.postCode) parts.push(addr.postCode);

        return {
            street: addr.thoroughfare || addr.fullThoroughfare || '',
            number: addr.subThoroughfare || '',
            complement: '',
            neighborhood: addr.subLocality || addr.dependentLocalities?.[0] || '',
            city: addr.locality || '',
            state: addr.administrativeArea || addr.administrativeAreaCode || '',
            zip_code: addr.postCode || '',
            latitude: loc.latitude || null,
            longitude: loc.longitude || null,
            formatted_address: result.formattedAddressLines?.join(', ') || parts.join(', ') || result.name || '',
            name: result.name || '',
        };
    }
}

module.exports = new AppleMapsService();
