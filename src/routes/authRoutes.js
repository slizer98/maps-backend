// src/routes/authRoutes.js
const express = require('express')
const authController = require('../controllers/authController')
const authMiddleware = require('../middleware/auth')
const cors = require('cors')

const router = express.Router()

// Si tienes CORS global en app.js no es necesario repetir aquí.
// Pero si quieres ser explícito por ruta:
const corsOptions = { origin: true, credentials: true }

// ---- Rutas públicas + preflight explícito
router.options('/login', cors(corsOptions))
router.options('/register', cors(corsOptions))
router.options('/status', cors(corsOptions))

router.post('/login', cors(corsOptions), authController.login)
router.post('/register', cors(corsOptions), authController.register)
router.get('/status', cors(corsOptions), (req, res) => {
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
  })
})

// ---- Rutas protegidas (todo lo que siga aplica authenticateToken)
router.use(cors(corsOptions), authMiddleware.authenticateToken)

// Preflight para las protegidas
router.options('/logout', cors(corsOptions))
router.options('/me', cors(corsOptions))
router.options('/profile', cors(corsOptions))
router.options('/location', cors(corsOptions))
router.options('/online', cors(corsOptions))

router.post('/logout', authController.logout)
router.get('/me', authController.me)
router.put('/profile', authController.updateProfile)
router.post('/location', authController.updateLocation)
router.get('/online', authController.getOnlineUsers)

module.exports = router
