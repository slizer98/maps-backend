const { verifyIdToken } = require('../config/firebase');
const User = require('../models/User');
const Room = require('../models/Room');

// Almacenar conexiones activas
const activeConnections = new Map();
const userSockets = new Map(); // userId -> socketId

const socketHandler = (io) => {
  // Middleware de autenticación para Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Token de autenticación requerido'));
      }

      // Verificar token con Firebase
      const decodedToken = await verifyIdToken(token);
      
      // Buscar usuario en la base de datos
      const user = await User.findById(decodedToken.uid);
      
      if (!user) {
        return next(new Error('Usuario no encontrado'));
      }

      // Agregar información del usuario al socket
      socket.userId = user.uid;
      socket.user = user;
      
      next();
    } catch (error) {
      console.error('Error en autenticación Socket.IO:', error.message);
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`✅ Usuario conectado: ${socket.user.displayName} (${socket.userId})`);
    
    // Almacenar conexión
    activeConnections.set(socket.id, {
      userId: socket.userId,
      user: socket.user,
      connectedAt: new Date(),
      currentRoom: null
    });
    
    userSockets.set(socket.userId, socket.id);

    // Actualizar estado online del usuario
    try {
      await User.setOnlineStatus(socket.userId, true);
    } catch (error) {
      console.error('Error actualizando estado online:', error);
    }

    // Unirse a room personal para notificaciones
    socket.join(`user_${socket.userId}`);

    // Eventos de rooms
    socket.on('join_room', async (data) => {
      try {
        const { roomId, role = 'passenger' } = data;
        
        // Verificar que el room existe
        const room = await Room.findById(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room no encontrado', code: 'ROOM_NOT_FOUND' });
          return;
        }

        // Verificar que el usuario está en el room
        if (!room.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'No estás en este room', code: 'NOT_IN_ROOM' });
          return;
        }

        // Salir del room anterior si existe
        if (activeConnections.get(socket.id).currentRoom) {
          socket.leave(activeConnections.get(socket.id).currentRoom);
        }

        // Unirse al room
        socket.join(roomId);
        activeConnections.get(socket.id).currentRoom = roomId;

        // Notificar a otros en el room
        socket.to(roomId).emit('user_connected_to_room', {
          user: {
            uid: socket.userId,
            name: socket.user.displayName,
            photo: socket.user.photoURL,
            role: room.drivers.includes(socket.userId) ? 'driver' : 'passenger'
          },
          timestamp: new Date()
        });

        socket.emit('joined_room', { roomId, room });
        console.log(`👥 ${socket.user.displayName} se unió al room: ${room.name}`);

      } catch (error) {
        console.error('Error uniéndose al room:', error);
        socket.emit('error', { message: 'Error al unirse al room', details: error.message });
      }
    });

    socket.on('leave_room', async (data) => {
      try {
        const { roomId } = data;
        const currentRoom = activeConnections.get(socket.id).currentRoom;
        
        if (currentRoom && currentRoom === roomId) {
          socket.leave(roomId);
          activeConnections.get(socket.id).currentRoom = null;

          // Notificar a otros en el room
          socket.to(roomId).emit('user_disconnected_from_room', {
            userId: socket.userId,
            userName: socket.user.displayName,
            timestamp: new Date()
          });

          socket.emit('left_room', { roomId });
          console.log(`👋 ${socket.user.displayName} salió del room: ${roomId}`);
        }

      } catch (error) {
        console.error('Error saliendo del room:', error);
        socket.emit('error', { message: 'Error al salir del room', details: error.message });
      }
    });

    // Eventos de mensajería
    socket.on('send_message', async (data) => {
      try {
        const { roomId, content, type = 'text' } = data;
        
        if (!content || content.trim().length === 0) {
          socket.emit('error', { message: 'Contenido del mensaje requerido', code: 'MISSING_CONTENT' });
          return;
        }

        // Verificar que el usuario está en el room
        const room = await Room.findById(roomId);
        if (!room || !room.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'No tienes permisos para enviar mensajes a este room', code: 'NO_PERMISSION' });
          return;
        }

        const messageData = {
          userId: socket.userId,
          userName: socket.user.displayName,
          userPhoto: socket.user.photoURL,
          content: content.trim(),
          type: type
        };

        const message = await Room.addMessage(roomId, messageData);

        // Enviar mensaje a todos en el room
        io.to(roomId).emit('new_message', {
          message: message,
          roomId: roomId
        });

        console.log(`💬 Mensaje de ${socket.user.displayName} en room ${roomId}: ${content.substring(0, 50)}...`);

      } catch (error) {
        console.error('Error enviando mensaje:', error);
        socket.emit('error', { message: 'Error al enviar mensaje', details: error.message });
      }
    });

    // Eventos de ubicación
    socket.on('update_location', async (data) => {
      try {
        const { latitude, longitude, accuracy } = data;
        
        if (!latitude || !longitude) {
          socket.emit('error', { message: 'Coordenadas requeridas', code: 'MISSING_COORDINATES' });
          return;
        }

        // Actualizar ubicación en la base de datos
        await User.updateLocation(socket.userId, {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          accuracy: accuracy ? parseFloat(accuracy) : null
        });

        // Obtener room actual del usuario
        const user = await User.findById(socket.userId);
        if (user && user.currentRoom) {
          // Enviar ubicación a otros en el room
          socket.to(user.currentRoom).emit('user_location_update', {
            userId: socket.userId,
            userName: user.displayName,
            location: {
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude),
              accuracy: accuracy ? parseFloat(accuracy) : null,
              timestamp: new Date()
            }
          });
        }

      } catch (error) {
        console.error('Error actualizando ubicación:', error);
        socket.emit('error', { message: 'Error al actualizar ubicación', details: error.message });
      }
    });

    // Eventos de typing
    socket.on('typing_start', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.displayName,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.displayName,
        isTyping: false
      });
    });

    // Ping/Pong para mantener conexión
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Obtener usuarios online en un room
    socket.on('get_room_users', async (data) => {
      try {
        const { roomId } = data;
        const users = await User.getUsersInRoom(roomId);
        
        socket.emit('room_users', {
          roomId: roomId,
          users: users.map(user => ({
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen
          }))
        });

      } catch (error) {
        console.error('Error obteniendo usuarios del room:', error);
        socket.emit('error', { message: 'Error al obtener usuarios del room', details: error.message });
      }
    });

    // Manejo de desconexión
    socket.on('disconnect', async (reason) => {
      console.log(`❌ Usuario desconectado: ${socket.user.displayName} (${reason})`);
      
      try {
        // Actualizar estado offline
        await User.setOnlineStatus(socket.userId, false);

        // Notificar a room actual si existe
        const connection = activeConnections.get(socket.id);
        if (connection && connection.currentRoom) {
          socket.to(connection.currentRoom).emit('user_disconnected_from_room', {
            userId: socket.userId,
            userName: socket.user.displayName,
            reason: reason,
            timestamp: new Date()
          });
        }

        // Limpiar conexiones
        activeConnections.delete(socket.id);
        userSockets.delete(socket.userId);

      } catch (error) {
        console.error('Error en desconexión:', error);
      }
    });

    // Enviar estado inicial
    socket.emit('connected', {
      message: 'Conectado exitosamente',
      user: {
        uid: socket.userId,
        name: socket.user.displayName,
        photo: socket.user.photoURL
      },
      timestamp: new Date()
    });
  });

  // Función helper para enviar notificación a usuario específico
  const sendToUser = (userId, event, data) => {
    const socketId = userSockets.get(userId);
    if (socketId) {
      io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  };

  // Función helper para obtener usuarios conectados
  const getConnectedUsers = () => {
    return Array.from(activeConnections.values()).map(conn => ({
      userId: conn.userId,
      user: conn.user,
      connectedAt: conn.connectedAt,
      currentRoom: conn.currentRoom
    }));
  };

  // Función helper para obtener estadísticas
  const getStats = () => {
    const connections = Array.from(activeConnections.values());
    const roomCounts = {};
    
    connections.forEach(conn => {
      if (conn.currentRoom) {
        roomCounts[conn.currentRoom] = (roomCounts[conn.currentRoom] || 0) + 1;
      }
    });

    return {
      totalConnections: connections.length,
      roomConnections: roomCounts,
      timestamp: new Date()
    };
  };

  // Exponer funciones útiles
  io.sendToUser = sendToUser;
  io.getConnectedUsers = getConnectedUsers;
  io.getStats = getStats;

  console.log('🔌 Socket.IO configurado correctamente');
};

module.exports = socketHandler;

