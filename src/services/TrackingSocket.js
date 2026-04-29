const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/database');
const PushNotificationService = require('./PushNotificationService');
const appleMapsService = require('./AppleMapsService');

const trackingRooms = new Map();
const pushService = new PushNotificationService();

async function fetchDirectionsForRoom(room) {
  const roomData = trackingRooms.get(room);
  if (!roomData || !roomData.dest_lat || !roomData.dest_lng) return null;

  try {
    const accessToken = await appleMapsService.getAccessToken();
    const url = `https://maps-api.apple.com/v1/directions?origin=${roomData.provider_lat},${roomData.provider_lng}&destination=${roomData.dest_lat},${roomData.dest_lng}&transportType=Automobile&lang=pt-BR`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    let polylinePoints = [];
    const apiSteps = data.steps || [];
    const stepPaths = data.stepPaths || [];

    for (const step of apiSteps) {
      const pathIndex = step.stepPathIndex;
      if (pathIndex != null && stepPaths[pathIndex]) {
        polylinePoints = polylinePoints.concat(stepPaths[pathIndex]);
      }
    }

    return {
      distance: route.distanceMeters || 0,
      duration: route.durationSeconds || 0,
      polyline: polylinePoints,
    };
  } catch (err) {
    console.error('[Tracking WS] Erro ao calcular rota:', err.message);
    return null;
  }
}

function setupTrackingSocket(io) {
  const trackingNs = io.of('/tracking');

  trackingNs.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Token não fornecido'));
    }
    try {
      const decoded = verifyToken(token);
      socket.userId = decoded.id || decoded.userId;
      next();
    } catch {
      return next(new Error('Token inválido'));
    }
  });

  trackingNs.on('connection', (socket) => {
    console.log(`[Tracking WS] Conectado: user ${socket.userId}`);

    socket.on('join-order', async (orderId) => {
      try {
        const [orders] = await pool.execute(
          `SELECT id, client_id, provider_id FROM orders WHERE id = ?`,
          [orderId]
        );
        if (orders.length === 0) {
          console.log(`[Tracking WS] Ordem ${orderId} não encontrada`);
          return;
        }

        const order = orders[0];
        const uid = Number(socket.userId);

        if (uid !== Number(order.client_id) && uid !== Number(order.provider_id)) {
          return;
        }

        const room = `order-${orderId}`;
        socket.join(room);
        socket.orderId = orderId;
        socket.role = uid === Number(order.provider_id) ? 'provider' : 'client';

        console.log(`[Tracking WS] User ${socket.userId} (${socket.role}) entrou na sala ${room}`);

        socket.emit('joined', { role: socket.role });

        if (trackingRooms.has(room)) {
          const roomData = trackingRooms.get(room);
          const directions = await fetchDirectionsForRoom(room);
          socket.emit('tracking-active', {
            provider_lat: roomData.provider_lat,
            provider_lng: roomData.provider_lng,
            ...(directions || {}),
          });
        }
      } catch (err) {
        console.error('[Tracking WS] Erro join-order:', err.message);
      }
    });

    socket.on('start-tracking', async (data) => {
      if (socket.role !== 'provider') return;
      const room = `order-${socket.orderId}`;

      const [orderRows] = await pool.execute(
        `SELECT o.id, o.title, o.status, o.client_id, o.latitude, o.longitude, u.name AS provider_name
         FROM orders o
         JOIN users u ON u.id = o.provider_id
         WHERE o.id = ?`,
        [socket.orderId]
      );
      if (orderRows.length === 0) return;
      const orderData = orderRows[0];

      if (orderData.status === 'completed' || orderData.status === 'cancelled') {
        socket.emit('tracking-error', { reason: 'order_inactive', status: orderData.status });
        return;
      }

      const trackingData = {
        provider_lat: data.latitude,
        provider_lng: data.longitude,
        dest_lat: Number(orderData.latitude),
        dest_lng: Number(orderData.longitude),
        active: true,
        lastRouteCalc: 0,
      };
      trackingRooms.set(room, trackingData);

      const directions = await fetchDirectionsForRoom(room);
      if (directions) {
        trackingData.lastRouteCalc = Date.now();
        trackingRooms.set(room, trackingData);
      }

      trackingNs.to(room).emit('tracking-started', {
        provider_lat: data.latitude,
        provider_lng: data.longitude,
        ...(directions || {}),
      });
      console.log(`[Tracking WS] Tracking iniciado na sala ${room}`);

      try {
        const [clients] = await pool.execute(
          `SELECT fcm_token, device_platform FROM users WHERE id = ?`,
          [orderData.client_id]
        );
        if (clients.length > 0 && clients[0].fcm_token) {
          const client = clients[0];
          await pushService.sendAlert({
            registration_id: client.fcm_token,
            device: client.device_platform || 'android',
            title: 'Prestador a caminho! 🚗',
            message: `${orderData.provider_name} iniciou o trajeto até você para "${orderData.title}"`,
            sound: 'default',
            extra_data: {
              type: 'tracking_started',
              order_id: String(orderData.id),
            },
          });
          console.log(`[Tracking WS] Push enviado para cliente ${orderData.client_id}`);
        }
      } catch (pushErr) {
        console.error('[Tracking WS] Erro ao enviar push:', pushErr.message);
      }
    });

    socket.on('location-update', async (data) => {
      if (socket.role !== 'provider') return;
      const room = `order-${socket.orderId}`;
      const roomData = trackingRooms.get(room);
      if (!roomData) return;

      roomData.provider_lat = data.latitude;
      roomData.provider_lng = data.longitude;
      trackingRooms.set(room, roomData);

      const payload = {
        provider_lat: data.latitude,
        provider_lng: data.longitude,
      };

      const now = Date.now();
      if (now - (roomData.lastRouteCalc || 0) >= 15000) {
        const directions = await fetchDirectionsForRoom(room);
        if (directions) {
          roomData.lastRouteCalc = now;
          trackingRooms.set(room, roomData);
          payload.distance = directions.distance;
          payload.duration = directions.duration;
          payload.polyline = directions.polyline;
        }
      }

      trackingNs.to(room).emit('location-update', payload);
    });

    socket.on('stop-tracking', () => {
      if (socket.role !== 'provider') return;
      const room = `order-${socket.orderId}`;
      trackingRooms.delete(room);
      trackingNs.to(room).emit('tracking-stopped');
      console.log(`[Tracking WS] Tracking encerrado na sala ${room}`);
    });

    socket.on('disconnect', () => {
      if (socket.role === 'provider' && socket.orderId) {
        const room = `order-${socket.orderId}`;
        if (trackingRooms.has(room)) {
          trackingRooms.delete(room);
          trackingNs.to(room).emit('tracking-stopped');
          console.log(`[Tracking WS] Provider desconectou, tracking encerrado na sala ${room}`);
        }
      }
      console.log(`[Tracking WS] Desconectado: user ${socket.userId}`);
    });
  });
}

function getProviderLocation(orderId) {
  const room = `order-${orderId}`;
  const data = trackingRooms.get(room);
  if (!data) return null;
  return { lat: data.provider_lat, lng: data.provider_lng };
}

module.exports = { setupTrackingSocket, getProviderLocation };
