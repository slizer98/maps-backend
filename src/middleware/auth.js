const { verifyIdToken } = require('../config/firebase');

// Middleware para verificar token de Firebase
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Token de autorización requerido',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Formato de token inválido',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Verificar token con Firebase
    const decodedToken = await verifyIdToken(token);
    
    // Agregar información del usuario a la request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
      firebase: decodedToken
    };

    next();
  } catch (error) {
    console.error('Error en autenticación:', error.message);
    return res.status(401).json({ 
      error: 'Token inválido o expirado',
      code: 'INVALID_TOKEN',
      details: error.message
    });
  }
};

// Middleware opcional - no falla si no hay token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      
      if (token) {
        const decodedToken = await verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified,
          name: decodedToken.name,
          picture: decodedToken.picture,
          firebase: decodedToken
        };
      }
    }
    
    next();
  } catch (error) {
    // En modo opcional, continuamos sin usuario autenticado
    console.log('Token opcional inválido:', error.message);
    next();
  }
};

// Middleware para verificar roles específicos
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Autenticación requerida',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRoles = req.user.firebase.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({ 
        error: 'Permisos insuficientes',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: userRoles
      });
    }

    next();
  };
};

// Middleware para verificar que el usuario es propietario del recurso
const requireOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Autenticación requerida',
          code: 'AUTH_REQUIRED'
        });
      }

      const resourceOwnerId = await getResourceOwnerId(req);
      
      if (resourceOwnerId !== req.user.uid) {
        return res.status(403).json({ 
          error: 'No tienes permisos para acceder a este recurso',
          code: 'NOT_OWNER'
        });
      }

      next();
    } catch (error) {
      console.error('Error verificando propiedad:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireOwnership
};

