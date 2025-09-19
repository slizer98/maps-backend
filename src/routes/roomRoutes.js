const express = require('express');
const roomController = require('../controllers/roomController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware.authenticateToken);

// Rutas de rooms
router.get('/', roomController.getAll);
router.post('/', roomController.create);
router.get('/:id', roomController.getById);
router.put('/:id', roomController.update);
router.delete('/:id', roomController.delete);
router.post('/:id/join', roomController.join);
router.post('/:id/leave', roomController.leave);
router.get('/:id/participants', roomController.getParticipants);

module.exports = router;

