const Room = require('../models/Room');
const User = require('../models/User');

class RoomController {
  // Obtener todos los rooms
  async getAll(req, res) {
    try {
      const { page = 1, limit = 20, status, search, createdBy } = req.query;
      
      const filters = {};
      if (status) {
        filters.status = status;
      }
      if (search) {
        filters.search = search.trim();
      }
      if (createdBy) {
        filters.createdBy = createdBy;
      }

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        ...filters
      };

      const result = await Room.findAll(options);

      res.json({
        success: true,
        rooms: result.rooms.map(room => ({
          id: room.id,
          name: room.name,
          description: room.description,
          status: room.status,
          maxParticipants: room.maxParticipants,
          currentParticipants: room.currentParticipants,
          isPrivate: room.isPrivate,
          createdBy: room.createdBy,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt
        })),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: result.pages
        }
      });

    } catch (error) {
      console.error('Error obteniendo rooms:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Obtener room por ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de room requerido'
        });
      }

      const room = await Room.findById(id);

      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room no encontrado'
        });
      }

      // Verificar si el usuario puede acceder al room
      const userId = req.user.id;
      const canAccess = !room.isPrivate || 
                       room.createdBy === userId || 
                       room.participants.some(p => p.userId === userId) ||
                       req.user.role === 'admin';

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: 'No tienes acceso a este room'
        });
      }

      res.json({
        success: true,
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          status: room.status,
          maxParticipants: room.maxParticipants,
          currentParticipants: room.currentParticipants,
          isPrivate: room.isPrivate,
          createdBy: room.createdBy,
          participants: room.participants,
          settings: room.settings,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt
        }
      });

    } catch (error) {
      console.error('Error obteniendo room:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Crear room
  async create(req, res) {
    try {
      const userId = req.user.id;
      const { 
        name, 
        description, 
        maxParticipants = 10, 
        isPrivate = false,
        settings = {}
      } = req.body;

      // Validaciones
      if (!name || name.trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: 'El nombre del room debe tener al menos 3 caracteres'
        });
      }

      if (name.trim().length > 50) {
        return res.status(400).json({
          success: false,
          error: 'El nombre del room no puede exceder 50 caracteres'
        });
      }

      if (description && description.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'La descripción no puede exceder 200 caracteres'
        });
      }

      if (maxParticipants < 2 || maxParticipants > 50) {
        return res.status(400).json({
          success: false,
          error: 'El número de participantes debe estar entre 2 y 50'
        });
      }

      // Verificar límite de rooms por usuario
      const userRoomsCount = await Room.countByCreator(userId);
      if (userRoomsCount >= 10) {
        return res.status(400).json({
          success: false,
          error: 'Has alcanzado el límite máximo de rooms (10)'
        });
      }

      // Crear room
      const roomData = {
        name: name.trim(),
        description: description?.trim() || null,
        status: 'active',
        maxParticipants: parseInt(maxParticipants),
        currentParticipants: 1,
        isPrivate: Boolean(isPrivate),
        createdBy: userId,
        participants: [{
          userId,
          role: 'admin',
          joinedAt: new Date(),
          isOnline: true
        }],
        settings: {
          allowLocationSharing: true,
          allowMessaging: true,
          autoDeleteMessages: false,
          messageRetentionDays: 30,
          ...settings
        }
      };

      const room = await Room.create(roomData);

      res.status(201).json({
        success: true,
        message: 'Room creado exitosamente',
        room: {
          id: room.id,
          name: room.name,
          description: room.description,
          status: room.status,
          maxParticipants: room.maxParticipants,
          currentParticipants: room.currentParticipants,
          isPrivate: room.isPrivate,
          createdBy: room.createdBy,
          participants: room.participants,
          settings: room.settings,
          createdAt: room.createdAt
        }
      });

    } catch (error) {
      console.error('Error creando room:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Actualizar room
  async update(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { name, description, maxParticipants, isPrivate, settings, status } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de room requerido'
        });
      }

      // Verificar que el room existe
      const room = await Room.findById(id);
      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room no encontrado'
        });
      }

      // Verificar permisos (creador o admin del room)
      const isCreator = room.createdBy === userId;
      const isRoomAdmin = room.participants.some(p => p.userId === userId && p.role === 'admin');
      const isSystemAdmin = req.user.role === 'admin';

      if (!isCreator && !isRoomAdmin && !isSystemAdmin) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permisos para actualizar este room'
        });
      }

      // Validaciones
      if (name && (name.trim().length < 3 || name.trim().length > 50)) {
        return res.status(400).json({
          success: false,
          error: 'El nombre del room debe tener entre 3 y 50 caracteres'
        });
      }

      if (description && description.length > 200) {
        return res.status(400).json({
          success: false,
          error: 'La descripción no puede exceder 200 caracteres'
        });
      }

      if (maxParticipants && (maxParticipants < room.currentParticipants || maxParticipants > 50)) {
        return res.status(400).json({
          success: false,
          error: `El número de participantes debe ser mayor a ${room.currentParticipants} y menor a 50`
        });
      }

      if (status && !['active', 'inactive', 'full'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Estado inválido'
        });
      }

      // Actualizar room
      const updateData = {
        updatedAt: new Date()
      };

      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (maxParticipants !== undefined) updateData.maxParticipants = parseInt(maxParticipants);
      if (isPrivate !== undefined) updateData.isPrivate = Boolean(isPrivate);
      if (status !== undefined) updateData.status = status;
      if (settings !== undefined) {
        updateData.settings = {
          ...room.settings,
          ...settings
        };
      }

      const updatedRoom = await Room.updateById(id, updateData);

      res.json({
        success: true,
        message: 'Room actualizado exitosamente',
        room: {
          id: updatedRoom.id,
          name: updatedRoom.name,
          description: updatedRoom.description,
          status: updatedRoom.status,
          maxParticipants: updatedRoom.maxParticipants,
          currentParticipants: updatedRoom.currentParticipants,
          isPrivate: updatedRoom.isPrivate,
          createdBy: updatedRoom.createdBy,
          participants: updatedRoom.participants,
          settings: updatedRoom.settings,
          createdAt: updatedRoom.createdAt,
          updatedAt: updatedRoom.updatedAt
        }
      });

    } catch (error) {
      console.error('Error actualizando room:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Eliminar room
  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de room requerido'
        });
      }

      // Verificar que el room existe
      const room = await Room.findById(id);
      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room no encontrado'
        });
      }

      // Verificar permisos (solo creador o admin del sistema)
      const isCreator = room.createdBy === userId;
      const isSystemAdmin = req.user.role === 'admin';

      if (!isCreator && !isSystemAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Solo el creador o un administrador pueden eliminar este room'
        });
      }

      // Eliminar room
      await Room.deleteById(id);

      res.json({
        success: true,
        message: 'Room eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando room:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Unirse a room
  async join(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { role = 'passenger' } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de room requerido'
        });
      }

      // Verificar que el room existe
      const room = await Room.findById(id);
      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room no encontrado'
        });
      }

      // Verificar estado del room
      if (room.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'El room no está activo'
        });
      }

      // Verificar si ya está en el room
      const isAlreadyParticipant = room.participants.some(p => p.userId === userId);
      if (isAlreadyParticipant) {
        return res.status(400).json({
          success: false,
          error: 'Ya eres participante de este room'
        });
      }

      // Verificar capacidad
      if (room.currentParticipants >= room.maxParticipants) {
        return res.status(400).json({
          success: false,
          error: 'El room está lleno'
        });
      }

      // Validar rol
      if (!['driver', 'passenger'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Rol inválido'
        });
      }

      // Agregar participante
      const newParticipant = {
        userId,
        role,
        joinedAt: new Date(),
        isOnline: true
      };

      const updatedRoom = await Room.addParticipant(id, newParticipant);

      res.json({
        success: true,
        message: 'Te has unido al room exitosamente',
        room: {
          id: updatedRoom.id,
          name: updatedRoom.name,
          description: updatedRoom.description,
          status: updatedRoom.status,
          maxParticipants: updatedRoom.maxParticipants,
          currentParticipants: updatedRoom.currentParticipants,
          isPrivate: updatedRoom.isPrivate,
          createdBy: updatedRoom.createdBy,
          participants: updatedRoom.participants,
          settings: updatedRoom.settings
        }
      });

    } catch (error) {
      console.error('Error uniéndose al room:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Salir de room
  async leave(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de room requerido'
        });
      }

      // Verificar que el room existe
      const room = await Room.findById(id);
      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room no encontrado'
        });
      }

      // Verificar si es participante
      const isParticipant = room.participants.some(p => p.userId === userId);
      if (!isParticipant) {
        return res.status(400).json({
          success: false,
          error: 'No eres participante de este room'
        });
      }

      // No permitir que el creador salga si hay otros participantes
      if (room.createdBy === userId && room.currentParticipants > 1) {
        return res.status(400).json({
          success: false,
          error: 'No puedes salir del room mientras haya otros participantes. Transfiere la administración o elimina el room.'
        });
      }

      // Remover participante
      const updatedRoom = await Room.removeParticipant(id, userId);

      // Si era el último participante, eliminar el room
      if (updatedRoom.currentParticipants === 0) {
        await Room.deleteById(id);
        return res.json({
          success: true,
          message: 'Has salido del room y este ha sido eliminado por estar vacío'
        });
      }

      res.json({
        success: true,
        message: 'Has salido del room exitosamente',
        room: {
          id: updatedRoom.id,
          name: updatedRoom.name,
          currentParticipants: updatedRoom.currentParticipants,
          participants: updatedRoom.participants
        }
      });

    } catch (error) {
      console.error('Error saliendo del room:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Obtener participantes del room
  async getParticipants(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'ID de room requerido'
        });
      }

      // Verificar que el room existe
      const room = await Room.findById(id);
      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room no encontrado'
        });
      }

      // Verificar acceso
      const hasAccess = !room.isPrivate || 
                       room.participants.some(p => p.userId === userId) ||
                       req.user.role === 'admin';

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'No tienes acceso a este room'
        });
      }

      // Obtener información detallada de participantes
      const participants = await Room.getParticipantsWithDetails(id);

      res.json({
        success: true,
        participants: participants.map(p => ({
          userId: p.userId,
          displayName: p.displayName,
          photoURL: p.photoURL,
          role: p.role,
          isOnline: p.isOnline,
          joinedAt: p.joinedAt,
          lastSeen: p.lastSeen,
          location: p.location
        })),
        count: participants.length
      });

    } catch (error) {
      console.error('Error obteniendo participantes:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new RoomController();

