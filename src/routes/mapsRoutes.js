const express = require('express');
const mapsController = require('../controllers/mapsController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware.authenticateToken);

// Rutas de mapas
router.get('/status', mapsController.getStatus);
router.post('/geocode', mapsController.geocode);
router.post('/reverse-geocode', mapsController.reverseGeocode);
router.post('/directions', mapsController.getDirections);
router.post('/distance-matrix', mapsController.getDistanceMatrix);
router.post('/nearby-places', mapsController.getNearbyPlaces);
router.get('/place/:placeId', mapsController.getPlaceDetails);
router.post('/optimize-route', mapsController.optimizeRoute);
router.post('/calculate-distance', mapsController.calculateDistance);
router.post('/check-radius', mapsController.checkWithinRadius);

module.exports = router;

