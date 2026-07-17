const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const { setupTrackingSocket } = require('./services/TrackingSocket');
const scheduleReminderService = require('./services/ScheduleReminderService');
const AdDispatchService = require('./services/AdDispatchService');
const criminalCheckCron = require('./services/CriminalCheckCron');
const reEngagementCron = require('./services/ReEngagementCron');
const ProviderRating = require('./models/ProviderRating');
const ProfileView = require('./models/ProfileView');

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

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});

setupTrackingSocket(io);

const adDispatcher = new AdDispatchService();

server.listen(PORT, () => {
    console.log(`🚀 Cotaja API está rodando na porta ${PORT}`);
    console.log(`📁 Ambiente: ${process.env.APP_ENV || 'development'}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`📋 API Health: http://localhost:${PORT}/api/health`);
    console.log(`🔌 WebSocket ativo em /tracking`);

    // Garante as tabelas auto-criadas uma única vez no startup (antes eram criadas a
    // cada requisição, o que desperdiçava conexões do pool). ensureTable é memoizado,
    // então qualquer chamada posterior dentro de requisições retorna sem tocar o banco.
    Promise.all([ProviderRating.ensureTable(), ProfileView.ensureTable()])
        .then(() => console.log('✅ Tabelas auto-criadas verificadas (provider_ratings, profile_views)'))
        .catch(err => console.error('❌ Erro ao garantir tabelas no startup:', err.message));

    scheduleReminderService.start();
    adDispatcher.startCronJob(60000);
    criminalCheckCron.start();
    reEngagementCron.start();
});