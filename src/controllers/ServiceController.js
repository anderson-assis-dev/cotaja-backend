const Service = require('../models/Service');
const User = require('../models/User');
const { sendPushNotification } = require('../middlewares/pushNotification');

class ServiceController {
    async create(req, res) {
        try {
            const { title, description, price, category, status, images } = req.body;
            const client_id = req.user.id;
            const client_name = req.user.name;

            if (!title || !description || !price || !category) {
                return res.status(422).json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: {
                        message: 'Título, descrição, preço e categoria são obrigatórios'
                    }
                });
            }

            // Validate images if provided
            if (images && (!Array.isArray(images) || images.length > 5)) {
                return res.status(422).json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: {
                        message: 'Máximo de 5 imagens são permitidas'
                    }
                });
            }

            const service = await Service.create({
                title,
                description,
                price,
                category,
                status: status || 'active',
                provider_id: client_id,
                images: images || []
            });

            // Notify all providers about the new service request
            this.notifyProviders(service, client_name, category);

            return res.status(201).json({
                success: true,
                message: 'Serviço criado com sucesso',
                data: service
            });
        } catch (error) {
            console.error('Erro ao criar serviço:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    /**
     * Notify all providers about a new service request
     * This runs asynchronously and doesn't block the response
     */
    async notifyProviders(service, clientName, category) {
        try {
            console.log(`📢 Notifying providers about new service: ${service.title}`);

            // Get all providers with FCM tokens (optionally filtered by category)
            const providers = await User.getProviderTokens(category);

            if (providers.length === 0) {
                console.log('⚠️  No providers with FCM tokens found');
                return;
            }

            console.log(`📱 Found ${providers.length} providers to notify`);

            // Send notifications in parallel
            const notificationPromises = providers.map(provider => {
                return sendPushNotification({
                    registration_id: provider.token,
                    device: provider.platform,
                    title: '🔔 Novo Pedido de Serviço!',
                    message: `${clientName} solicitou: ${service.title}`,
                    sound: 'default',
                    production: process.env.NODE_ENV === 'production'
                }).catch(error => {
                    console.error(`Failed to send notification to provider ${provider.id}:`, error.message);
                    return { success: false, provider_id: provider.id, error: error.message };
                });
            });

            const results = await Promise.all(notificationPromises);

            const successCount = results.filter(r => r && r.success).length;
            console.log(`✅ Notifications sent: ${successCount}/${providers.length}`);

        } catch (error) {
            console.error('❌ Error notifying providers:', error);
            // Don't throw - we don't want to fail the service creation if notifications fail
        }
    }

    async update(req, res) {
        try {
            const { id } = req.params;
            const { title, description, price, category, status, images } = req.body;
            const provider_id = req.user.id;

            if (!title || !description || !price || !category) {
                return res.status(422).json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: {
                        message: 'Título, descrição, preço e categoria são obrigatórios'
                    }
                });
            }

            // Validate images if provided
            if (images && (!Array.isArray(images) || images.length > 5)) {
                return res.status(422).json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: {
                        message: 'Máximo de 5 imagens são permitidas'
                    }
                });
            }

            const existingService = await Service.findById(id);
            if (!existingService) {
                return res.status(404).json({
                    success: false,
                    message: 'Serviço não encontrado'
                });
            }

            if (existingService.provider_id !== provider_id) {
                return res.status(403).json({
                    success: false,
                    message: 'Você não tem permissão para editar este serviço'
                });
            }

            const updatedService = await Service.update(id, {
                title,
                description,
                price,
                category,
                status: status || 'active',
                images: images !== undefined ? images : existingService.images
            });

            return res.status(200).json({
                success: true,
                message: 'Serviço atualizado com sucesso',
                data: updatedService
            });
        } catch (error) {
            console.error('Erro ao atualizar serviço:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async index(req, res) {
        try {
            const { status, category } = req.query;
            const filters = {};

            if (status) filters.status = status;
            if (category) filters.category = category;

            const services = await Service.findAll(filters);

            return res.status(200).json({
                success: true,
                message: 'Serviços listados com sucesso',
                data: services
            });
        } catch (error) {
            console.error('Erro ao listar serviços:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async myServices(req, res) {
        try {
            const provider_id = req.user.id;
            const services = await Service.findByProviderId(provider_id);

            return res.status(200).json({
                success: true,
                message: 'Meus serviços listados com sucesso',
                data: services
            });
        } catch (error) {
            console.error('Erro ao listar meus serviços:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async show(req, res) {
        try {
            const { id } = req.params;
            const service = await Service.findById(id);

            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: 'Serviço não encontrado'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Serviço encontrado',
                data: service
            });
        } catch (error) {
            console.error('Erro ao buscar serviço:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.params;
            const provider_id = req.user.id;

            const existingService = await Service.findById(id);
            if (!existingService) {
                return res.status(404).json({
                    success: false,
                    message: 'Serviço não encontrado'
                });
            }

            if (existingService.provider_id !== provider_id) {
                return res.status(403).json({
                    success: false,
                    message: 'Você não tem permissão para excluir este serviço'
                });
            }

            await Service.delete(id);

            return res.status(200).json({
                success: true,
                message: 'Serviço excluído com sucesso'
            });
        } catch (error) {
            console.error('Erro ao excluir serviço:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}

module.exports = new ServiceController();