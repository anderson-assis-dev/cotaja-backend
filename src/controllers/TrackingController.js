const appleMapsService = require('../services/AppleMapsService');

class TrackingController {
  async getDirections(req, res) {
    try {
      const { origin_lat, origin_lng, dest_lat, dest_lng } = req.query;

      if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
        return res.status(400).json({ success: false, message: 'Coordenadas de origem e destino são obrigatórias' });
      }

      const accessToken = await appleMapsService.getAccessToken();

      const url = `https://maps-api.apple.com/v1/directions?origin=${origin_lat},${origin_lng}&destination=${dest_lat},${dest_lng}&transportType=Automobile&lang=pt-BR`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[Tracking] Directions API erro:', response.status, errText);
        return res.status(502).json({ success: false, message: 'Erro ao buscar rota' });
      }

      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        return res.status(404).json({ success: false, message: 'Nenhuma rota encontrada' });
      }

      const route = data.routes[0];
      const steps = [];
      let polylinePoints = [];

      const apiSteps = data.steps || [];
      const stepPaths = data.stepPaths || [];

      for (const step of apiSteps) {
        steps.push({
          instruction: step.instructions || '',
          distance: step.distanceMeters || 0,
          duration: step.durationSeconds || 0,
        });
        const pathIndex = step.stepPathIndex;
        if (pathIndex != null && stepPaths[pathIndex]) {
          polylinePoints = polylinePoints.concat(stepPaths[pathIndex]);
        }
      }

      return res.json({
        success: true,
        data: {
          distance: route.distanceMeters || 0,
          duration: route.durationSeconds || 0,
          polyline: polylinePoints,
          steps,
        }
      });
    } catch (error) {
      console.error('[Tracking] Erro directions:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao buscar direções' });
    }
  }

  async getMapToken(req, res) {
    try {
      const token = appleMapsService.generateMapKitToken();
      return res.json({ success: true, data: { token } });
    } catch (error) {
      console.error('[Tracking] Erro token:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao gerar token do mapa' });
    }
  }
}

module.exports = new TrackingController();
