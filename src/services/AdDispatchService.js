const { Ad, UserSearchCategory } = require('../models/AdCredit');
const User = require('../models/User');
const PushNotificationService = require('./PushNotificationService');

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class AdDispatchService {
  constructor() {
    this.pushService = new PushNotificationService();
    this.isRunning = false;
  }

  async processScheduledAds() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const pendingAds = await Ad.findPendingToSend();

      for (const ad of pendingAds) {
        try {
          let sentCount = 0;

          if (ad.ad_type === 'single' || ad.ad_type === 'general') {
            sentCount = await this.sendToAll(ad);
          } else if (ad.ad_type === 'targeted') {
            sentCount = await this.sendTargeted(ad);
          }

          await Ad.markSent(ad.id, sentCount);
          console.log(`[AdDispatch] Ad ${ad.id} (${ad.ad_type}) enviado para ${sentCount} usuários`);
        } catch (error) {
          console.error(`[AdDispatch] Falha ao enviar ad ${ad.id}:`, error.message);
          await Ad.markFailed(ad.id);
        }
      }
    } catch (error) {
      console.error('[AdDispatch] processScheduledAds error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async sendToAll(ad) {
    const { pool } = require('../config/database');
    const connection = await pool.getConnection();
    try {
      const targetType = ad.profile_type === 'provider' ? 'client' : 'provider';

      const [users] = await connection.execute(
        `SELECT id, fcm_token, device_platform FROM users
         WHERE fcm_token IS NOT NULL AND fcm_token != ''
         AND id != ? AND profile_type = ?`,
        [ad.user_id, targetType]
      );

      console.log(`[AdDispatch] sendToAll: ad ${ad.id} (criador: ${ad.profile_type}) -> ${users.length} ${targetType}(s)`);

      let sentCount = 0;
      for (const user of users) {
        try {
          await this.pushService.sendAlert({
            registration_id: user.fcm_token,
            device: user.device_platform || 'ios',
            title: ad.title,
            message: ad.message,
            sound: 'default',
            extra_data: {
              type: 'ad_notification',
              ad_id: String(ad.id),
              ad_type: ad.ad_type,
              provider_name: ad.user_name || 'Cotaja',
            },
          });
          sentCount++;
        } catch {
        }
      }
      return sentCount;
    } finally {
      connection.release();
    }
  }

  async sendTargeted(ad) {
    const categories = ad.target_categories || ad.service_categories || [];
    if (categories.length === 0) {
      console.warn(`[AdDispatch] Ad ${ad.id}: sem categorias, fallback para sendToAll`);
      return this.sendToAll(ad);
    }

    if (ad.profile_type === 'provider') {
      return this.sendTargetedToClients(ad, categories);
    } else {
      return this.sendTargetedToProviders(ad, categories);
    }
  }

  async sendTargetedToClients(ad, categories) {
    const interestedClients = await UserSearchCategory.getUsersInterestedInCategories(categories, ad.user_id);

    const adLat = ad.provider_lat ? Number(ad.provider_lat) : null;
    const adLng = ad.provider_lng ? Number(ad.provider_lng) : null;
    const radiusKm = 100;

    let targetUsers = interestedClients;
    if (adLat && adLng) {
      targetUsers = interestedClients.filter(u => {
        if (!u.latitude || !u.longitude) return true;
        const dist = haversineDistance(adLat, adLng, Number(u.latitude), Number(u.longitude));
        return dist <= radiusKm;
      });
    }

    console.log(`[AdDispatch] sendTargetedToClients: ad ${ad.id} -> ${targetUsers.length} clientes (de ${interestedClients.length} interessados)`);

    let sentCount = 0;
    for (const user of targetUsers) {
      try {
        await this.pushService.sendAlert({
          registration_id: user.fcm_token,
          device: user.device_platform || 'ios',
          title: ad.title,
          message: ad.message,
          sound: 'default',
          extra_data: {
            type: 'ad_notification',
            ad_id: String(ad.id),
            ad_type: 'targeted',
            provider_name: ad.user_name || 'Cotaja',
          },
        });
        sentCount++;
      } catch {
      }
    }
    return sentCount;
  }

  async sendTargetedToProviders(ad, categories) {
    const providers = await UserSearchCategory.getProvidersForTargetedAd(categories, ad.user_id);

    const adLat = ad.provider_lat ? Number(ad.provider_lat) : null;
    const adLng = ad.provider_lng ? Number(ad.provider_lng) : null;
    const radiusKm = 100;

    let targetProviders = providers;
    if (adLat && adLng) {
      targetProviders = providers.filter(p => {
        if (!p.latitude || !p.longitude) return true;
        const dist = haversineDistance(adLat, adLng, Number(p.latitude), Number(p.longitude));
        return dist <= radiusKm;
      });
    }

    console.log(`[AdDispatch] sendTargetedToProviders: ad ${ad.id} -> ${targetProviders.length} prestadores (de ${providers.length} com categoria)`);

    let sentCount = 0;
    for (const provider of targetProviders) {
      try {
        await this.pushService.sendAlert({
          registration_id: provider.fcm_token,
          device: provider.device_platform || 'ios',
          title: ad.title,
          message: ad.message,
          sound: 'default',
          extra_data: {
            type: 'ad_notification',
            ad_id: String(ad.id),
            ad_type: 'targeted',
            provider_name: ad.user_name || 'Cotaja',
          },
        });
        sentCount++;
      } catch {
      }
    }
    return sentCount;
  }

  startCronJob(intervalMs = 60000) {
    console.log(`[AdDispatch] Cron iniciado (intervalo: ${intervalMs}ms)`);
    this.interval = setInterval(() => this.processScheduledAds(), intervalMs);
    this.processScheduledAds();
  }

  stopCronJob() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

module.exports = AdDispatchService;
