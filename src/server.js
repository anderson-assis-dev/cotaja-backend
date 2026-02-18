const app = require('./app');
const scheduleReminderService = require('./services/ScheduleReminderService');

const PORT = process.env.APP_PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Cotaja API está rodando na porta ${PORT}`);
    console.log(`📁 Ambiente: ${process.env.APP_ENV || 'development'}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📋 API Health: http://localhost:${PORT}/api/health`);

    // Start schedule reminder service
    scheduleReminderService.start();
});