const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false,
            message: 'Dados inválidos',
            errors: errors.mapped()
        });
    }
    next();
};

const registerValidation = [
    body('name')
        .notEmpty()
        .withMessage('Nome é obrigatório')
        .isLength({ max: 255 })
        .withMessage('Nome deve ter no máximo 255 caracteres'),
    body('email')
        .isEmail()
        .withMessage('Email deve ser válido')
        .isLength({ max: 255 })
        .withMessage('Email deve ter no máximo 255 caracteres'),
    body('phone')
        .notEmpty()
        .withMessage('Telefone é obrigatório')
        .isLength({ max: 20 })
        .withMessage('Telefone deve ter no máximo 20 caracteres'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Senha deve ter pelo menos 6 caracteres'),
    body('password_confirmation')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Confirmação de senha não confere');
            }
            return true;
        }),
    handleValidationErrors
];

const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Email deve ser válido'),
    body('password')
        .notEmpty()
        .withMessage('Senha é obrigatória'),
    handleValidationErrors
];

const updateProfileValidation = [
    body('name')
        .optional()
        .isLength({ max: 255 })
        .withMessage('Nome deve ter no máximo 255 caracteres'),
    body('phone')
        .optional()
        .isLength({ max: 20 })
        .withMessage('Telefone deve ter no máximo 20 caracteres'),
    body('address')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Endereço deve ter no máximo 500 caracteres'),
    body('profile_type')
        .optional()
        .isIn(['client', 'provider'])
        .withMessage('Tipo de perfil deve ser client ou provider'),
    body('service_categories')
        .optional()
        .isArray()
        .withMessage('Categorias de serviço devem ser um array'),
    body('service_categories.*')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Cada categoria deve ter no máximo 100 caracteres'),
    handleValidationErrors
];

const updateProfileTypeValidation = [
    body('profile_type')
        .isIn(['client', 'provider'])
        .withMessage('Tipo de perfil deve ser client ou provider'),
    body('service_categories')
        .optional()
        .isArray()
        .withMessage('Categorias de serviço devem ser um array'),
    body('service_categories.*')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Cada categoria deve ter no máximo 100 caracteres'),
    handleValidationErrors
];

const fcmTokenValidation = [
    body('fcm_token')
        .notEmpty()
        .withMessage('Token FCM é obrigatório'),
    handleValidationErrors
];

const createOrderValidation = [
    body('title')
        .notEmpty()
        .withMessage('Título é obrigatório')
        .isLength({ max: 255 })
        .withMessage('Título deve ter no máximo 255 caracteres'),
    body('description')
        .notEmpty()
        .withMessage('Descrição é obrigatória'),
    body('category')
        .notEmpty()
        .withMessage('Categoria é obrigatória')
        .isLength({ max: 100 })
        .withMessage('Categoria deve ter no máximo 100 caracteres'),
    body('budget')
        .isNumeric()
        .withMessage('Orçamento deve ser um número')
        .isFloat({ min: 0 })
        .withMessage('Orçamento deve ser maior ou igual a 0'),
    body('deadline')
        .isInt({ min: 1, max: 365 })
        .withMessage('Prazo deve ser um número entre 1 e 365 dias'),
    body('address')
        .notEmpty()
        .withMessage('Endereço é obrigatório'),
    handleValidationErrors
];

const updateOrderValidation = [
    body('title')
        .optional()
        .isLength({ max: 255 })
        .withMessage('Título deve ter no máximo 255 caracteres'),
    body('description')
        .optional()
        .notEmpty()
        .withMessage('Descrição não pode estar vazia'),
    body('category')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Categoria deve ter no máximo 100 caracteres'),
    body('budget')
        .optional()
        .isNumeric()
        .withMessage('Orçamento deve ser um número')
        .isFloat({ min: 0 })
        .withMessage('Orçamento deve ser maior ou igual a 0'),
    body('deadline')
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage('Prazo deve ser um número entre 1 e 365 dias'),
    body('address')
        .optional()
        .notEmpty()
        .withMessage('Endereço não pode estar vazio'),
    body('status')
        .optional()
        .isIn(['open', 'in_progress', 'completed', 'cancelled'])
        .withMessage('Status deve ser open, in_progress, completed ou cancelled'),
    handleValidationErrors
];

const createProposalValidation = [
    body('price')
        .isNumeric()
        .withMessage('Preço deve ser um número')
        .isFloat({ min: 0 })
        .withMessage('Preço deve ser maior ou igual a 0'),
    body('deadline')
        .notEmpty()
        .withMessage('Prazo é obrigatório'),
    body('description')
        .notEmpty()
        .withMessage('Descrição é obrigatória'),
    body('order_id')
        .isInt()
        .withMessage('ID do pedido deve ser um número'),
    handleValidationErrors
];

const updateProposalValidation = [
    body('price')
        .optional()
        .isNumeric()
        .withMessage('Preço deve ser um número')
        .isFloat({ min: 0 })
        .withMessage('Preço deve ser maior ou igual a 0'),
    body('deadline')
        .optional()
        .notEmpty()
        .withMessage('Prazo não pode estar vazio'),
    body('description')
        .optional()
        .notEmpty()
        .withMessage('Descrição não pode estar vazia'),
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    registerValidation,
    loginValidation,
    updateProfileValidation,
    updateProfileTypeValidation,
    fcmTokenValidation,
    createOrderValidation,
    updateOrderValidation,
    createProposalValidation,
    updateProposalValidation
};