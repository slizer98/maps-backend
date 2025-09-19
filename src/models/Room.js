const { getFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

class Room {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.description = data.description || '';
    this.createdBy = data.createdBy;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.maxParticipants = data.maxParticipants || 50;
    this.currentParticipants = data.currentParticipants || 0;
    this.participants = data.participants || [];
    this.drivers = data.drivers || [];
    this.passengers = data.passengers || [];
    this.messages = data.messages || [];
    this.location = data.location || null; // Ubicación central del room
    this.radius = data.radius || 10000; // Radio en metros
    this.settings = data.settings || {
      allowMessages: true,
      allowLocationSharing: true,
      autoAssignRoles: false,
      requireApproval: false
    };
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.stats = data.stats || {
      totalMessages: 0,
      totalParticipants: 0,
      activeDrivers: 0,
      activePassengers: 0
    };
  }

  // Convertir a objeto plano para Firestore
  toFirestore() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdBy: this.createdBy,
      isActive: this.isActive,
      maxParticipants: this.maxParticipants,
      currentParticipants: this.currentParticipants,
      participants: this.participants,
      drivers: this.drivers,
      passengers: this.passengers,
      messages: this.messages.slice(-50), // Solo guardar últimos 50 mensajes
      location: this.location,
      radius: this.radius,
      settings: this.settings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      stats: this.stats
    };
  }

  // Crear desde documento de Firestore
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    return new Room({ ...doc.data() });
  }

  // Métodos estáticos para operaciones CRUD
  static async create(roomData) {
    try {
      const db = getFirestore();
      const room = new Room(roomData);
      
      await db.collection('rooms').doc(room.id).set(room.toFirestore());
      return room;
    } catch (error) {
      throw new Error('Error al crear room: ' + error.message);
    }
  }

  static async findById(roomId) {
    try {
      const db = getFirestore();
      const doc = await db.collection('rooms').doc(roomId).get();
      return Room.fromFirestore(doc);
    } catch (error) {
      throw new Error('Error al buscar room: ' + error.message);
    }
  }

  static async findByCreator(creatorId) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection('rooms')
        .where('createdBy', '==', creatorId)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => Room.fromFirestore(doc));
    } catch (error) {
      throw new Error('Error al buscar rooms por creador: ' + error.message);
    }
  }

  static async getActiveRooms() {
    try {
      const db = getFirestore();
      const snapshot = await db.collection('rooms')
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
      return snapshot.docs.map(doc => Room.fromFirestore(doc));
    } catch (error) {
      throw new Error('Error al obtener rooms activos: ' + error.message);
    }
  }

  static async update(roomId, updateData) {
    try {
      const db = getFirestore();
      updateData.updatedAt = new Date();
      
      await db.collection('rooms').doc(roomId).update(updateData);
      return await Room.findById(roomId);
    } catch (error) {
      throw new Error('Error al actualizar room: ' + error.message);
    }
  }

  static async delete(roomId) {
    try {
      const db = getFirestore();
      await db.collection('rooms').doc(roomId).delete();
      return true;
    } catch (error) {
      throw new Error('Error al eliminar room: ' + error.message);
    }
  }

  // Métodos para gestión de participantes
  static async addParticipant(roomId, userId, role = 'passenger') {
    try {
      const db = getFirestore();
      const room = await Room.findById(roomId);
      
      if (!room) {
        throw new Error('Room no encontrado');
      }

      if (room.participants.includes(userId)) {
        throw new Error('El usuario ya está en el room');
      }

      if (room.currentParticipants >= room.maxParticipants) {
        throw new Error('Room lleno');
      }

      const updateData = {
        participants: [...room.participants, userId],
        currentParticipants: room.currentParticipants + 1,
        updatedAt: new Date()
      };

      // Agregar a la lista específica según el rol
      if (role === 'driver') {
        updateData.drivers = [...room.drivers, userId];
        updateData['stats.activeDrivers'] = room.stats.activeDrivers + 1;
      } else {
        updateData.passengers = [...room.passengers, userId];
        updateData['stats.activePassengers'] = room.stats.activePassengers + 1;
      }

      updateData['stats.totalParticipants'] = room.stats.totalParticipants + 1;

      await db.collection('rooms').doc(roomId).update(updateData);
      return await Room.findById(roomId);
    } catch (error) {
      throw new Error('Error al agregar participante: ' + error.message);
    }
  }

  static async removeParticipant(roomId, userId) {
    try {
      const db = getFirestore();
      const room = await Room.findById(roomId);
      
      if (!room) {
        throw new Error('Room no encontrado');
      }

      if (!room.participants.includes(userId)) {
        throw new Error('El usuario no está en el room');
      }

      const updateData = {
        participants: room.participants.filter(id => id !== userId),
        currentParticipants: room.currentParticipants - 1,
        updatedAt: new Date()
      };

      // Remover de las listas específicas
      if (room.drivers.includes(userId)) {
        updateData.drivers = room.drivers.filter(id => id !== userId);
        updateData['stats.activeDrivers'] = Math.max(0, room.stats.activeDrivers - 1);
      }
      
      if (room.passengers.includes(userId)) {
        updateData.passengers = room.passengers.filter(id => id !== userId);
        updateData['stats.activePassengers'] = Math.max(0, room.stats.activePassengers - 1);
      }

      await db.collection('rooms').doc(roomId).update(updateData);
      return await Room.findById(roomId);
    } catch (error) {
      throw new Error('Error al remover participante: ' + error.message);
    }
  }

  // Métodos para mensajería
  static async addMessage(roomId, messageData) {
    try {
      const db = getFirestore();
      const room = await Room.findById(roomId);
      
      if (!room) {
        throw new Error('Room no encontrado');
      }

      const message = {
        id: uuidv4(),
        userId: messageData.userId,
        userName: messageData.userName,
        userPhoto: messageData.userPhoto,
        content: messageData.content,
        type: messageData.type || 'text', // text, location, system
        timestamp: new Date(),
        edited: false,
        editedAt: null
      };

      const updatedMessages = [...room.messages, message].slice(-100); // Mantener últimos 100 mensajes

      await db.collection('rooms').doc(roomId).update({
        messages: updatedMessages,
        'stats.totalMessages': room.stats.totalMessages + 1,
        updatedAt: new Date()
      });

      return message;
    } catch (error) {
      throw new Error('Error al agregar mensaje: ' + error.message);
    }
  }

  static async getMessages(roomId, limit = 50, offset = 0) {
    try {
      const room = await Room.findById(roomId);
      
      if (!room) {
        throw new Error('Room no encontrado');
      }

      const messages = room.messages
        .slice(-limit - offset, -offset || undefined)
        .reverse();

      return messages;
    } catch (error) {
      throw new Error('Error al obtener mensajes: ' + error.message);
    }
  }

  // Búsqueda de rooms
  static async searchRooms(query, filters = {}) {
    try {
      const db = getFirestore();
      let queryRef = db.collection('rooms')
        .where('isActive', '==', true);

      // TODO: Implementar búsqueda por texto cuando Firestore lo soporte mejor
      // Por ahora, obtener todos los activos y filtrar en memoria
      
      const snapshot = await queryRef.limit(50).get();
      let rooms = snapshot.docs.map(doc => Room.fromFirestore(doc));

      // Filtrar por nombre si hay query
      if (query) {
        rooms = rooms.filter(room => 
          room.name.toLowerCase().includes(query.toLowerCase()) ||
          room.description.toLowerCase().includes(query.toLowerCase())
        );
      }

      return rooms;
    } catch (error) {
      throw new Error('Error al buscar rooms: ' + error.message);
    }
  }

  // Obtener rooms cercanos a una ubicación
  static async getNearbyRooms(latitude, longitude, radiusKm = 10) {
    try {
      // TODO: Implementar búsqueda geoespacial con GeoFirestore
      // Por ahora, obtener todos los activos
      const rooms = await Room.getActiveRooms();
      
      // Filtrar por distancia en memoria (no eficiente para producción)
      const nearbyRooms = rooms.filter(room => {
        if (!room.location) return false;
        
        const distance = calculateDistance(
          latitude, longitude,
          room.location.latitude, room.location.longitude
        );
        
        return distance <= radiusKm;
      });

      return nearbyRooms;
    } catch (error) {
      throw new Error('Error al obtener rooms cercanos: ' + error.message);
    }
  }
}

// Función helper para calcular distancia
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = Room;

