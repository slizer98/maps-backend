const admin = require('firebase-admin');

let isConfigured = false;

try {
  // Verificar si las credenciales de Firebase están disponibles
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    isConfigured = true;
    console.log('✅ Firebase Admin SDK inicializado correctamente');
  } else {
    console.log('⚠️  Firebase no configurado - usando modo desarrollo');
  }
} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error.message);
}

// Funciones helper para Firebase Auth
const verifyIdToken = async (idToken) => {
  if (!isConfigured) {
    throw new Error('Firebase no está configurado');
  }
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    throw new Error('Token inválido: ' + error.message);
  }
};

const createCustomToken = async (uid, additionalClaims = {}) => {
  if (!isConfigured) {
    throw new Error('Firebase no está configurado');
  }
  
  try {
    const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
    return customToken;
  } catch (error) {
    throw new Error('Error al crear token personalizado: ' + error.message);
  }
};

const getUserByEmail = async (email) => {
  if (!isConfigured) {
    throw new Error('Firebase no está configurado');
  }
  
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    return userRecord;
  } catch (error) {
    throw new Error('Usuario no encontrado: ' + error.message);
  }
};

const createUser = async (userData) => {
  if (!isConfigured) {
    throw new Error('Firebase no está configurado');
  }
  
  try {
    const userRecord = await admin.auth().createUser(userData);
    return userRecord;
  } catch (error) {
    throw new Error('Error al crear usuario: ' + error.message);
  }
};

const updateUser = async (uid, userData) => {
  if (!isConfigured) {
    throw new Error('Firebase no está configurado');
  }
  
  try {
    const userRecord = await admin.auth().updateUser(uid, userData);
    return userRecord;
  } catch (error) {
    throw new Error('Error al actualizar usuario: ' + error.message);
  }
};

const deleteUser = async (uid) => {
  if (!isConfigured) {
    throw new Error('Firebase no está configurado');
  }
  
  try {
    await admin.auth().deleteUser(uid);
    return true;
  } catch (error) {
    throw new Error('Error al eliminar usuario: ' + error.message);
  }
};

// Firestore helpers
const getFirestore = () => {
  if (!isConfigured) {
    throw new Error('Firebase no está configurado');
  }
  return admin.firestore();
};

module.exports = {
  admin,
  isConfigured,
  verifyIdToken,
  createCustomToken,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  getFirestore
};

