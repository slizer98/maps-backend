// src/config/firebase.js
const admin = require('firebase-admin')

let isConfigured = false

function initAdmin() {
  // Evita reinicializar si ya hay una app activa
  if (admin.apps.length) {
    isConfigured = true
    return admin.app()
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) {
    // No lanzamos error aquí para permitir que el servidor arranque,
    // pero cualquier uso de funciones abajo fallará con mensaje claro.
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_KEY no está definido. Firebase Admin NO quedará configurado.')
    isConfigured = false
    return null
  }

  let serviceAccount
  try {
    serviceAccount = JSON.parse(raw)
  } catch (e) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY no es JSON válido:', e.message)
    isConfigured = false
    throw e
  }

  const options = {
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id, // asegura proyecto correcto
  }

  // Opcional: si usas Realtime Database en algún módulo
  if (process.env.FIREBASE_DATABASE_URL) {
    options.databaseURL = process.env.FIREBASE_DATABASE_URL
  }

  admin.initializeApp(options)
  isConfigured = true
  console.log('✅ Firebase Admin SDK inicializado correctamente para el proyecto:', serviceAccount.project_id)
  return admin.app()
}

// Helpers internos para asegurarnos de que está inicializado
function ensureConfigured() {
  if (!isConfigured || !admin.apps.length) {
    initAdmin()
  }
  if (!isConfigured) {
    throw new Error(
      'Firebase no está configurado. Define FIREBASE_SERVICE_ACCOUNT_KEY (JSON del Service Account) ' +
      'y opcionalmente FIREBASE_DATABASE_URL en variables de entorno.'
    )
  }
}

// =========================
//        AUTH HELPERS
// =========================
const verifyIdToken = async (idToken) => {
  ensureConfigured()
  try {
    return await admin.auth().verifyIdToken(idToken)
  } catch (error) {
    // Propaga mensaje claro hacia el middleware/controladores
    throw new Error('Token inválido: ' + (error?.message || 'Error desconocido'))
  }
}

const createCustomToken = async (uid, additionalClaims = {}) => {
  ensureConfigured()
  try {
    return await admin.auth().createCustomToken(uid, additionalClaims)
  } catch (error) {
    throw new Error('Error al crear token personalizado: ' + (error?.message || 'Error desconocido'))
  }
}

const getUserByEmail = async (email) => {
  ensureConfigured()
  try {
    return await admin.auth().getUserByEmail(email)
  } catch (error) {
    throw new Error('Usuario no encontrado: ' + (error?.message || 'Error desconocido'))
  }
}

const createUser = async (userData) => {
  ensureConfigured()
  try {
    return await admin.auth().createUser(userData)
  } catch (error) {
    throw new Error('Error al crear usuario: ' + (error?.message || 'Error desconocido'))
  }
}

const updateUser = async (uid, userData) => {
  ensureConfigured()
  try {
    return await admin.auth().updateUser(uid, userData)
  } catch (error) {
    throw new Error('Error al actualizar usuario: ' + (error?.message || 'Error desconocido'))
  }
}

const deleteUser = async (uid) => {
  ensureConfigured()
  try {
    await admin.auth().deleteUser(uid)
    return true
  } catch (error) {
    throw new Error('Error al eliminar usuario: ' + (error?.message || 'Error desconocido'))
  }
}

// =========================
//     FIRESTORE HELPER
// =========================
const getFirestore = () => {
  ensureConfigured()
  // Puedes ajustar settings si lo necesitas:
  // const db = admin.firestore()
  // db.settings({ ignoreUndefinedProperties: true })
  return admin.firestore()
}

// Exporta también initAdmin por si quieres forzar init en el boot del server
module.exports = {
  admin,
  isConfigured,         // bandera útil para diagnósticos
  initAdmin,
  verifyIdToken,
  createCustomToken,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  getFirestore,
}
