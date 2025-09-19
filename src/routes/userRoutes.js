const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware.authenticateToken);

// Rutas de usuarios
router.get('/', userController.getAll);
router.get('/search/:query', userController.search);
router.get('/stats/overview', userController.getStats);
router.get('/:id', userController.getById);
router.put('/:id', userController.update);
router.delete('/:id', userController.delete);
router.patch('/:id/role', userController.changeRole);

module.exports = router;

