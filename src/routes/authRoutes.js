const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Rutas públicas
router.post('/login', authController.login);
router.post('/register', authController.register);

// Rutas protegidas
router.use(authMiddleware.authenticateToken); // Aplicar middleware a todas las rutas siguientes

router.post('/logout', authController.logout);
router.get('/me', authController.me);
router.put('/profile', authController.updateProfile);
router.post('/location', authController.updateLocation);
router.get('/online', authController.getOnlineUsers);

// Verificar estado del servidor de autenticación
router.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Authentication Service',
    timestamp: new Date().toISOString(),
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      logout: 'POST /api/auth/logout',
      me: 'GET /api/auth/me',
      profile: 'PUT /api/auth/profile',
      location: 'POST /api/auth/location',
      online: 'GET /api/auth/online'
    }
  });
});

module.exports = router;

