const User = require('../models/User');

class UserController {
  // Obtener todos los usuarios
  async getAll(req, res) {
    try {
      const { page = 1, limit = 20, search, role, isOnline } = req.query;
      
      const filters = {};
      if (search) {
        filters.search = search.trim();
      }
      if (role) {
        filters.role = role;
      }
      if (isOnline !== undefined) {
        filters.isOnline = isOnline === 'true';
      }

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100), // Máximo 100 por página
        ...filters
      };

      const result = await User.findAll(options);

      res.json({
        success: true,
        users: result.users.map(user => ({
          id: user.id,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.role,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
          createdAt: user.createdAt
        })),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: result.pages
        }
      });

    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Obtener usuario por ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de usuario requerido'
        });
      }

      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

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

  // Actualizar usuario
  async update(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      const { displayName, photoURL, phoneNumber, role } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de usuario requerido'
        });
      }

      // Verificar que el usuario existe
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      // Verificar permisos
      const canUpdate = currentUser.id === id || currentUser.role === 'admin';
      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permisos para actualizar este usuario'
        });
      }

      // Solo admins pueden cambiar roles
      if (role && currentUser.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Solo administradores pueden cambiar roles'
        });
      }

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

      if (role && !['user', 'driver', 'passenger', 'admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Rol inválido'
        });
      }

      // Actualizar usuario
      const updateData = {
        updatedAt: new Date()
      };

      if (displayName !== undefined) updateData.displayName = displayName.trim();
      if (photoURL !== undefined) updateData.photoURL = photoURL;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (role !== undefined) updateData.role = role;

      const updatedUser = await User.updateById(id, updateData);

      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
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
      console.error('Error actualizando usuario:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Eliminar usuario
  async delete(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de usuario requerido'
        });
      }

      // Solo admins pueden eliminar usuarios
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Solo administradores pueden eliminar usuarios'
        });
      }

      // No permitir auto-eliminación
      if (currentUser.id === id) {
        return res.status(400).json({
          success: false,
          error: 'No puedes eliminar tu propia cuenta'
        });
      }

      // Verificar que el usuario existe
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      // Eliminar usuario
      await User.deleteById(id);

      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando usuario:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Buscar usuarios
  async search(req, res) {
    try {
      const { query } = req.params;
      const { limit = 10 } = req.query;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'La búsqueda debe tener al menos 2 caracteres'
        });
      }

      const users = await User.search(query.trim(), {
        limit: Math.min(parseInt(limit), 50)
      });

      res.json({
        success: true,
        users: users.map(user => ({
          id: user.id,
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.role,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen
        })),
        count: users.length
      });

    } catch (error) {
      console.error('Error buscando usuarios:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Obtener estadísticas de usuarios
  async getStats(req, res) {
    try {
      // Solo admins pueden ver estadísticas
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Solo administradores pueden ver estadísticas'
        });
      }

      const stats = await User.getStats();

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Cambiar rol de usuario
  async changeRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const currentUser = req.user;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de usuario requerido'
        });
      }

      // Solo admins pueden cambiar roles
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Solo administradores pueden cambiar roles'
        });
      }

      if (!role || !['user', 'driver', 'passenger', 'admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Rol inválido'
        });
      }

      // Verificar que el usuario existe
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      // No permitir cambiar el propio rol
      if (currentUser.id === id) {
        return res.status(400).json({
          success: false,
          error: 'No puedes cambiar tu propio rol'
        });
      }

      // Actualizar rol
      const updatedUser = await User.updateById(id, {
        role,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Rol actualizado exitosamente',
        user: {
          id: updatedUser.id,
          uid: updatedUser.uid,
          displayName: updatedUser.displayName,
          role: updatedUser.role
        }
      });

    } catch (error) {
      console.error('Error cambiando rol:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new UserController();

