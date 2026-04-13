const app = require('./app');
const scheduleReminderService = require('./services/ScheduleReminderService');
const AdDispatchService = require('./services/AdDispatchService');
const criminalCheckCron = require('./services/CriminalCheckCron');
const reEngagementCron = require('./services/ReEngagementCron');

const PORT = process.env.APP_PORT || 3000;

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