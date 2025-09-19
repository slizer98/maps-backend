# Maps App Backend

Servidor backend para la aplicación Maps App, construido con Node.js, Express.js, Socket.IO y Firebase.

## 🚀 Instalación Rápida

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar en desarrollo
npm run dev

# Ejecutar en producción
npm start
```

## 📋 Variables de Entorno Requeridas

```env
PORT=3000
NODE_ENV=development

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# CORS
CORS_ORIGIN=http://localhost:5173
```

## 🛠️ Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **Socket.IO** - Comunicación en tiempo real
- **Firebase Admin SDK** - Autenticación y base de datos
- **Google Maps API** - Servicios de mapas
- **CORS** - Cross-Origin Resource Sharing

## 📁 Estructura

```
src/
├── config/           # Configuraciones (Firebase, etc.)
├── controllers/      # Controladores de rutas
├── middleware/       # Middlewares (auth, etc.)
├── models/          # Modelos de datos
├── routes/          # Definición de rutas API
└── services/        # Servicios de negocio
```

## 🔌 API Endpoints

### Autenticación
- `POST /api/auth/login` - Login con Firebase token
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Usuario actual

### Usuarios
- `GET /api/users` - Listar usuarios
- `GET /api/users/:id` - Usuario por ID
- `PUT /api/users/:id` - Actualizar usuario

### Rooms
- `GET /api/rooms` - Listar rooms
- `POST /api/rooms` - Crear room
- `GET /api/rooms/:id` - Room por ID
- `PUT /api/rooms/:id` - Actualizar room
- `DELETE /api/rooms/:id` - Eliminar room

### Mapas
- `POST /api/maps/directions` - Calcular rutas
- `POST /api/maps/geocode` - Geocodificación
- `POST /api/maps/reverse-geocode` - Geocodificación inversa

## 🔌 Eventos Socket.IO

### Conexión
- `connect` / `disconnect` - Gestión de conexiones
- `connected` - Confirmación de autenticación

### Rooms
- `join_room` / `leave_room` - Gestión de rooms
- `user_joined_room` / `user_left_room` - Notificaciones

### Mensajes
- `send_message` / `new_message` - Chat en tiempo real
- `typing_start` / `typing_stop` - Indicadores de escritura

### Ubicación
- `update_location` / `user_location_update` - Tracking GPS

## 🔒 Seguridad

- Autenticación con Firebase JWT
- Middleware de validación en rutas protegidas
- CORS configurado para desarrollo
- Validación de datos de entrada

## 🚀 Despliegue

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

## 📝 Notas

- El servidor escucha en el puerto definido en `PORT` (default: 3000)
- CORS está configurado para permitir el frontend en desarrollo
- Socket.IO maneja la autenticación automáticamente
- Todas las rutas API están bajo el prefijo `/api`

