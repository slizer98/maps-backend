// src/controllers/authController.js
const { verifyIdToken } = require('../config/firebase')
const User = require('../models/User')

/** Helpers **/
function pickPublicUser(u) {
  // Mapea el usuario de Firestore a la salida pública del API
  return {
    id: u.uid,                     // compatibilidad con el front
    uid: u.uid,
    email: u.email || null,
    displayName: u.displayName || null,
    photoURL: u.photoURL || null,
    phoneNumber: u.phoneNumber || null,
    role: u.role || 'user',
    isOnline: !!u.isOnline,
    lastSeen: u.lastSeen || null,
    location: u.location || null,
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null,
    preferences: u.preferences || undefined,
    stats: u.stats || undefined,
  }
}

function safeDisplayName(decoded, userData) {
  const email = decoded.email || ''
  const fromEmail = email.includes('@') ? email.split('@')[0] : null
  return (userData?.displayName || decoded.name || fromEmail || 'Usuario')
}

class AuthController {
  // POST /api/auth/login
  async login(req, res) {
    try {
      const { idToken } = req.body
      if (!idToken) {
        return res.status(400).json({ success: false, error: 'Token de Firebase requerido' })
      }

      // ✅ Verifica el token usando el wrapper (esto garantiza initializeApp)
      const decoded = await verifyIdToken(idToken)

      const { uid, email, name, picture, email_verified, phone_number } = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        email_verified: decoded.email_verified,
        phone_number: decoded.phone_number,
      }

      // Buscar/crear usuario en Firestore (doc id = uid)
      let user = await User.findById(uid)

      if (!user) {
        user = await User.create({
          uid,
          email: email || null,
          displayName: safeDisplayName({ email, name }, null),
          photoURL: picture || null,
          emailVerified: !!email_verified,
          phoneNumber: phone_number || null,
          role: 'user',
          isOnline: true,
          lastSeen: new Date(),
          location: null,
          currentRoom: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          preferences: {
            notifications: true,
            locationSharing: true,
            theme: 'light',
          },
          stats: {
            roomsJoined: 0,
            messagesCount: 0,
            tripsCompleted: 0,
          },
        })
      } else {
        await User.setOnlineStatus(uid, true)
        user = await User.findById(uid)
      }

      return res.json({
        success: true,
        message: 'Login exitoso',
        user: pickPublicUser(user),
      })
    } catch (error) {
      console.error('Error en login:', error)
      // Errores comunes (si alguna vez corre en local sin TLS confiable)
      if (/SELF_SIGNED_CERT_IN_CHAIN/i.test(error?.message || '')) {
        return res.status(502).json({
          success: false,
          error: 'No se pudo verificar el token por certificados TLS. En local, configura NODE_EXTRA_CA_CERTS o usa backend en producción.',
        })
      }
      if (/id-?token.*expir/i.test(error?.message || '')) {
        return res.status(401).json({ success: false, error: 'Token expirado' })
      }
      if (/invalid.*id.?token/i.test(error?.message || '')) {
        return res.status(401).json({ success: false, error: 'Token inválido' })
      }
      return res.status(500).json({ success: false, error: 'Error interno del servidor' })
    }
  }

  // POST /api/auth/register
  async register(req, res) {
    try {
      const { idToken, userData } = req.body
      if (!idToken) {
        return res.status(400).json({ success: false, error: 'Token de Firebase requerido' })
      }

      const decoded = await verifyIdToken(idToken)
      const { uid, email, name, picture, email_verified, phone_number } = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        email_verified: decoded.email_verified,
        phone_number: decoded.phone_number,
      }

      const existing = await User.findById(uid)
      if (existing) {
        return res.status(409).json({ success: false, error: 'Usuario ya registrado' })
      }

      const user = await User.create({
        uid,
        email: email || null,
        displayName: safeDisplayName({ email, name }, userData),
        photoURL: userData?.photoURL || picture || null,
        emailVerified: !!email_verified,
        phoneNumber: userData?.phoneNumber || phone_number || null,
        role: 'user',
        isOnline: true,
        lastSeen: new Date(),
        location: null,
        currentRoom: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {
          notifications: true,
          locationSharing: true,
          theme: 'light',
          ...(userData?.preferences || {}),
        },
        stats: {
          roomsJoined: 0,
          messagesCount: 0,
          tripsCompleted: 0,
          ...(userData?.stats || {}),
        },
      })

      return res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        user: pickPublicUser(user),
      })
    } catch (error) {
      console.error('Error en registro:', error)
      if (/id-?token.*expir/i.test(error?.message || '')) {
        return res.status(401).json({ success: false, error: 'Token expirado' })
      }
      if (/invalid.*id.?token/i.test(error?.message || '')) {
        return res.status(401).json({ success: false, error: 'Token inválido' })
      }
      return res.status(500).json({ success: false, error: 'Error interno del servidor' })
    }
  }

  // POST /api/auth/logout
  async logout(req, res) {
    try {
      const uid = req.user?.uid || req.user?.id
      if (!uid) {
        return res.status(401).json({ success: false, error: 'No autenticado' })
      }

      await User.setOnlineStatus(uid, false)
      return res.json({ success: true, message: 'Logout exitoso' })
    } catch (error) {
      console.error('Error en logout:', error)
      return res.status(500).json({ success: false, error: 'Error interno del servidor' })
    }
  }

  // GET /api/auth/me
  async me(req, res) {
    try {
      const uid = req.user?.uid || req.user?.id
      if (!uid) {
        return res.status(401).json({ success: false, error: 'No autenticado' })
      }

      const user = await User.findById(uid)
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' })
      }

      return res.json({ success: true, user: pickPublicUser(user) })
    } catch (error) {
      console.error('Error obteniendo usuario:', error)
      return res.status(500).json({ success: false, error: 'Error interno del servidor' })
    }
  }

  // PUT /api/auth/profile
  async updateProfile(req, res) {
    try {
      const uid = req.user?.uid || req.user?.id
      if (!uid) {
        return res.status(401).json({ success: false, error: 'No autenticado' })
      }

      const { displayName, photoURL, phoneNumber } = req.body

      if (displayName && displayName.trim().length < 2) {
        return res.status(400).json({ success: false, error: 'El nombre debe tener al menos 2 caracteres' })
      }
      if (phoneNumber && !/^\+?[\d\s\-\(\)]+$/.test(phoneNumber)) {
        return res.status(400).json({ success: false, error: 'Formato de teléfono inválido' })
      }

      const updated = await User.update(uid, {
        ...(displayName !== undefined ? { displayName: displayName.trim() } : {}),
        ...(photoURL !== undefined ? { photoURL } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
      })

      return res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        user: pickPublicUser(updated),
      })
    } catch (error) {
      console.error('Error actualizando perfil:', error)
      return res.status(500).json({ success: false, error: 'Error interno del servidor' })
    }
  }

  // POST /api/auth/location
  async updateLocation(req, res) {
    try {
      const uid = req.user?.uid || req.user?.id
      if (!uid) {
        return res.status(401).json({ success: false, error: 'No autenticado' })
      }

      const { latitude, longitude, accuracy } = req.body
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, error: 'Latitud y longitud son requeridas' })
      }

      const lat = Number(latitude)
      const lng = Number(longitude)
      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ success: false, error: 'Latitud inválida' })
      }
      if (Number.isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ success: false, error: 'Longitud inválida' })
      }

      await User.updateLocation(uid, { latitude: lat, longitude: lng, accuracy })

      const updated = await User.findById(uid)
      return res.json({
        success: true,
        message: 'Ubicación actualizada exitosamente',
        location: updated.location || null,
      })
    } catch (error) {
      console.error('Error actualizando ubicación:', error)
      return res.status(500).json({ success: false, error: 'Error interno del servidor' })
    }
  }

  // GET /api/auth/online
  async getOnlineUsers(req, res) {
    try {
      const users = await User.getOnlineUsers()
      return res.json({
        success: true,
        users: users.map(pickPublicUser),
        count: users.length,
      })
    } catch (error) {
      console.error('Error obteniendo usuarios online:', error)
      return res.status(500).json({ success: false, error: 'Error interno del servidor' })
    }
  }
}

module.exports = new AuthController()
