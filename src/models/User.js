const { getFirestore } = require('../config/firebase');

class User {
  constructor(data) {
    this.uid = data.uid;
    this.email = data.email;
    this.displayName = data.displayName || data.name;
    this.photoURL = data.photoURL || data.picture;
    this.emailVerified = data.emailVerified || false;
    this.phoneNumber = data.phoneNumber || null;
    this.role = data.role || 'user'; // user, driver, admin
    this.isOnline = data.isOnline || false;
    this.lastSeen = data.lastSeen || new Date();
    this.location = data.location || null;
    this.currentRoom = data.currentRoom || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.preferences = data.preferences || {
      notifications: true,
      locationSharing: true,
      theme: 'light'
    };
    this.stats = data.stats || {
      roomsJoined: 0,
      messagesCount: 0,
      tripsCompleted: 0
    };
  }

  // Convertir a objeto plano para Firestore
  toFirestore() {
    return {
      uid: this.uid,
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      emailVerified: this.emailVerified,
      phoneNumber: this.phoneNumber,
      role: this.role,
      isOnline: this.isOnline,
      lastSeen: this.lastSeen,
      location: this.location,
      currentRoom: this.currentRoom,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      preferences: this.preferences,
      stats: this.stats
    };
  }

  // Crear desde documento de Firestore
  static fromFirestore(doc) {
    if (!doc.exists) return null;
    return new User({ id: doc.id, ...doc.data() });
  }

  // Métodos estáticos para operaciones CRUD
  static async create(userData) {
    try {
      const db = getFirestore();
      const user = new User(userData);
      
      await db.collection('users').doc(user.uid).set(user.toFirestore());
      return user;
    } catch (error) {
      throw new Error('Error al crear usuario: ' + error.message);
    }
  }

  static async findById(uid) {
    try {
      const db = getFirestore();
      const doc = await db.collection('users').doc(uid).get();
      return User.fromFirestore(doc);
    } catch (error) {
      throw new Error('Error al buscar usuario: ' + error.message);
    }
  }

  static async findByEmail(email) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      return User.fromFirestore(snapshot.docs[0]);
    } catch (error) {
      throw new Error('Error al buscar usuario por email: ' + error.message);
    }
  }

  static async update(uid, updateData) {
    try {
      const db = getFirestore();
      updateData.updatedAt = new Date();
      
      await db.collection('users').doc(uid).update(updateData);
      return await User.findById(uid);
    } catch (error) {
      throw new Error('Error al actualizar usuario: ' + error.message);
    }
  }

  static async delete(uid) {
    try {
      const db = getFirestore();
      await db.collection('users').doc(uid).delete();
      return true;
    } catch (error) {
      throw new Error('Error al eliminar usuario: ' + error.message);
    }
  }

  static async setOnlineStatus(uid, isOnline) {
    try {
      const db = getFirestore();
      await db.collection('users').doc(uid).update({
        isOnline,
        lastSeen: new Date(),
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw new Error('Error al actualizar estado online: ' + error.message);
    }
  }

  static async updateLocation(uid, location) {
    try {
      const db = getFirestore();
      await db.collection('users').doc(uid).update({
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date(),
          accuracy: location.accuracy || null
        },
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw new Error('Error al actualizar ubicación: ' + error.message);
    }
  }

  static async joinRoom(uid, roomId) {
    try {
      const db = getFirestore();
      await db.collection('users').doc(uid).update({
        currentRoom: roomId,
        updatedAt: new Date(),
        'stats.roomsJoined': require('firebase-admin').firestore.FieldValue.increment(1)
      });
      return true;
    } catch (error) {
      throw new Error('Error al unirse a room: ' + error.message);
    }
  }

  static async leaveRoom(uid) {
    try {
      const db = getFirestore();
      await db.collection('users').doc(uid).update({
        currentRoom: null,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw new Error('Error al salir de room: ' + error.message);
    }
  }

  static async getOnlineUsers() {
    try {
      const db = getFirestore();
      const snapshot = await db.collection('users')
        .where('isOnline', '==', true)
        .get();
      
      return snapshot.docs.map(doc => User.fromFirestore(doc));
    } catch (error) {
      throw new Error('Error al obtener usuarios online: ' + error.message);
    }
  }

  static async getUsersInRoom(roomId) {
    try {
      const db = getFirestore();
      const snapshot = await db.collection('users')
        .where('currentRoom', '==', roomId)
        .get();
      
      return snapshot.docs.map(doc => User.fromFirestore(doc));
    } catch (error) {
      throw new Error('Error al obtener usuarios en room: ' + error.message);
    }
  }
}

module.exports = User;

