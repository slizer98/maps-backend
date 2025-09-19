// src/middleware/auth.js
const { verifyIdToken } = require('../config/firebase')
const User = require('../models/User')

/**
 * Extrae token desde Authorization "Bearer <token>", cookie o body (fallbacks).
 */
function extractToken(req) {
  // 1) Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const t = authHeader.split(' ')[1]
    if (t) return t
  }

  // 2) Cookie (si usas cookies httpOnly con idToken; opcional)
  if (req.cookies && req.cookies.idToken) {
    return req.cookies.idToken
  }

  // 3) Body (fallback para pruebas; NO recomendado en prod)
  if (req.body && req.body.idToken) {
    return req.body.idToken
  }

  return null
}

/**
 * Middleware para verificar token de Firebase (requerido).
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Permite preflights CORS
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204)
    }

    const token = extractToken(req)
    if (!token) {
      return res.status(401).json({
        error: 'Token de autorización requerido',
        code: 'NO_TOKEN'
      })
    }

    // Verificar token (Firebase Admin)
    const decodedToken = await verifyIdToken(token)

    // Normaliza usuario básico en req.user
    req.user = {
      id: decodedToken.uid,                     // compatibilidad con controladores
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
      roles: decodedToken.roles || decodedToken['https://hasura.io/jwt/claims']?.['x-hasura-allowed-roles'] || [],
      firebase: decodedToken,                   // por si necesitas claims completos
    }

    // (Opcional) cargar documento de usuario desde Firestore
    try {
      const udoc = await User.findById(decodedToken.uid)
      if (udoc) req.userDoc = udoc
    } catch (e) {
      // Si falla Firestore no bloqueamos auth; puedes loguear si quieres.
      // console.log('No se pudo cargar userDoc:', e.message)
    }

    return next()
  } catch (error) {
    console.error('Error en autenticación:', error.message)
    return res.status(401).json({
      error: 'Token inválido o expirado',
      code: 'INVALID_TOKEN',
      details: error.message
    })
  }
}

/**
 * Middleware opcional — si hay token, autentica; si no, continúa como invitado.
 */
const optionalAuth = async (req, res, next) => {
  try {
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204)
    }

    const token = extractToken(req)
    if (token) {
      const decodedToken = await verifyIdToken(token)
      req.user = {
        id: decodedToken.uid,
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        name: decodedToken.name,
        picture: decodedToken.picture,
        roles: decodedToken.roles || [],
        firebase: decodedToken,
      }
      try {
        const udoc = await User.findById(decodedToken.uid)
        if (udoc) req.userDoc = udoc
      } catch (e) {}
    }
    return next()
  } catch (error) {
    // En modo opcional, no bloqueamos el paso
    console.log('Token opcional inválido:', error.message)
    return next()
  }
}

/**
 * Requiere que el usuario tenga al menos uno de los roles dados.
 * Los roles se leen de `req.user.roles` (poblados desde custom claims o similar).
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Autenticación requerida',
        code: 'AUTH_REQUIRED'
      })
    }
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : []
    const ok = roles.some(r => userRoles.includes(r))
    if (!ok) {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: userRoles
      })
    }
    return next()
  }
}

/**
 * Requiere que el recurso sea del usuario autenticado (compara con uid).
 * `getResourceOwnerId(req)` debe retornar el uid propietario del recurso.
 */
const requireOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Autenticación requerida',
          code: 'AUTH_REQUIRED'
        })
      }
      const ownerUid = await getResourceOwnerId(req)
      if (ownerUid !== req.user.uid) {
        return res.status(403).json({
          error: 'No tienes permisos para acceder a este recurso',
          code: 'NOT_OWNER'
        })
      }
      return next()
    } catch (error) {
      console.error('Error verificando propiedad:', error)
      return res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      })
    }
  }
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireOwnership
}
