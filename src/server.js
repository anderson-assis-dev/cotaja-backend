const app = require('./app');
const scheduleReminderService = require('./services/ScheduleReminderService');
const AdDispatchService = require('./services/AdDispatchService');
const criminalCheckCron = require('./services/CriminalCheckCron');
const reEngagementCron = require('./services/ReEngagementCron');

const PORT = process.env.APP_PORT || 3000;

function ts() { return new Date().toISOString().replace('T', ' ').substring(0, 19); }

const _log = console.log;
const _err = console.error;
const _warn = console.warn;
console.log = (...args) => _log(`[${ts()}]`, ...args);
console.error = (...args) => _err(`[${ts()}]`, ...args);
console.warn = (...args) => _warn(`[${ts()}]`, ...args);

process.on('uncaughtException', (err) => {
    console.error('❌ [FATAL] uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ [FATAL] unhandledRejection:', reason);
});

const adDispatcher = new AdDispatchService();

app.listen(PORT, () => {
    console.log(`🚀 Cotaja API está rodando na porta ${PORT}`);
    console.log(`📁 Ambiente: ${process.env.APP_ENV || 'development'}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📋 API Health: http://localhost:${PORT}/api/health`);

    scheduleReminderService.start();
    adDispatcher.startCronJob(60000);
    criminalCheckCron.start();
    reEngagementCron.start();
});