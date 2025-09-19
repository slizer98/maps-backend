const admin = require('firebase-admin');
const User = require('../models/User');

class AuthController {
  // Login con token de Firebase
  async login(req, res) {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({
          success: false,
          error: 'Token de Firebase requerido'
        });
      }

      // Verificar token con Firebase
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { uid, email, name, picture } = decodedToken;

      // Buscar o crear usuario en la base de datos
      let user = await User.findByUid(uid);
      
      if (!user) {
        // Crear nuevo usuario
        user = await User.create({
          uid,
          email,
          displayName: name || email.split('@')[0],
          photoURL: picture || null,
          role: 'user',
          isOnline: true,
          lastSeen: new Date(),
          location: null
        });
      } else {
        // Actualizar estado online
        await User.updateById(user.id, {
          isOnline: true,
          lastSeen: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Login exitoso',
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.role,
          isOnline: user.isOnline,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      console.error('Error en login:', error);
      
      if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({
          success: false,
          error: 'Token expirado'
        });
      }
      
      if (error.code === 'auth/invalid-id-token') {
        return res.status(401).json({
          success: false,
          error: 'Token inválido'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Registro de usuario
  async register(req, res) {
    try {
      const { idToken, userData } = req.body;

      if (!idToken) {
        return res.status(400).json({
          success: false,
          error: 'Token de Firebase requerido'
        });
      }

      // Verificar token con Firebase
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { uid, email, name, picture } = decodedToken;

      // Verificar si el usuario ya existe
      const existingUser = await User.findByUid(uid);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Usuario ya registrado'
        });
      }

      // Crear nuevo usuario
      const user = await User.create({
        uid,
        email,
        displayName: userData?.displayName || name || email.split('@')[0],
        photoURL: userData?.photoURL || picture || null,
        phoneNumber: userData?.phoneNumber || null,
        role: 'user',
        isOnline: true,
        lastSeen: new Date(),
        location: null
      });

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.role,
          isOnline: user.isOnline,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Logout
  async logout(req, res) {
    try {
      const userId = req.user.id;

      // Actualizar estado offline
      await User.updateById(userId, {
        isOnline: false,
        lastSeen: new Date()
      });

      res.json({
        success: true,
        message: 'Logout exitoso'
      });

    } catch (error) {
      console.error('Error en logout:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Obtener usuario actual
  async me(req, res) {
    try {
      const user = req.user;

      res.json({
        success: true,
        user: {
          id: user.id,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
          location: user.location,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });

    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Actualizar perfil
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { displayName, photoURL, phoneNumber } = req.body;

      // Validaciones
      if (displayName && displayName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'El nombre debe tener al menos 2 caracteres'
        });
      }

      if (phoneNumber && !/^\+?[\d\s\-\(\)]+$/.test(phoneNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Formato de teléfono inválido'
        });
      }

      // Actualizar usuario
      const updatedUser = await User.updateById(userId, {
        displayName: displayName?.trim(),
        photoURL,
        phoneNumber,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        user: {
          id: updatedUser.id,
          uid: updatedUser.uid,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          photoURL: updatedUser.photoURL,
          phoneNumber: updatedUser.phoneNumber,
          role: updatedUser.role,
          isOnline: updatedUser.isOnline,
          lastSeen: updatedUser.lastSeen,
          location: updatedUser.location,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt
        }
      });

    } catch (error) {
      console.error('Error actualizando perfil:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Actualizar ubicación
  async updateLocation(req, res) {
    try {
      const userId = req.user.id;
      const { latitude, longitude, accuracy } = req.body;

      // Validaciones
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Latitud y longitud son requeridas'
        });
      }

      if (latitude < -90 || latitude > 90) {
        return res.status(400).json({
          success: false,
          error: 'Latitud inválida'
        });
      }

      if (longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          error: 'Longitud inválida'
        });
      }

      // Actualizar ubicación
      const location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : null,
        timestamp: new Date()
      };

      await User.updateById(userId, {
        location,
        lastSeen: new Date()
      });

      res.json({
        success: true,
        message: 'Ubicación actualizada exitosamente',
        location
      });

    } catch (error) {
      console.error('Error actualizando ubicación:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Obtener usuarios online
  async getOnlineUsers(req, res) {
    try {
      const users = await User.findOnlineUsers();

      res.json({
        success: true,
        users: users.map(user => ({
          id: user.id,
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.role,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
          location: user.location
        })),
        count: users.length
      });

    } catch (error) {
      console.error('Error obteniendo usuarios online:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new AuthController();

