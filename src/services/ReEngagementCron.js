const dynamicNotificationService = require('./DynamicNotificationService');

const RUN_HOURS = [8, 11, 14, 17, 19];

class ReEngagementCron {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.lastRunHour = null;
    }

    start(checkIntervalMs = 60 * 1000) {
        console.log(`[ReEngagementCron] ⏰ Iniciado — disparará às ${RUN_HOURS.map(h => h + 'h').join(' e ')} diariamente`);
        this.intervalId = setInterval(() => this._tick(), checkIntervalMs);
        this._tick();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    _tick() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        if (RUN_HOURS.includes(hour) && minute < 5 && this.lastRunHour !== hour) {
            this.lastRunHour = hour;
            this._run();
        }
    }

    async _run() {
        if (this.isRunning) {
            console.log('[ReEngagementCron] ⚠️  Execução anterior ainda em andamento, pulando...');
            return;
        }

        this.isRunning = true;
        try {
            await dynamicNotificationService.runAll();
        } catch (err) {
            console.error('[ReEngagementCron] ❌ Erro inesperado:', err.message, err.stack);
        } finally {
            this.isRunning = false;
        }
    }
}

module.exports = new ReEngagementCron();
