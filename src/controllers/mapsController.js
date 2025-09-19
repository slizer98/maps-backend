const mapsService = require('../services/mapsService');

class MapsController {
  // Verificar estado del servicio de mapas
  async getStatus(req, res) {
    try {
      const isConfigured = mapsService.isConfigured();
      
      res.json({
        success: true,
        status: isConfigured ? 'configured' : 'not_configured',
        message: isConfigured 
          ? 'Google Maps API está configurado correctamente'
          : 'Google Maps API no está configurado'
      });

    } catch (error) {
      console.error('Error verificando estado de Maps:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  // Geocodificación (dirección a coordenadas)
  async geocode(req, res) {
    try {
      const { address } = req.body;

      if (!address || address.trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: 'Dirección requerida (mínimo 3 caracteres)'
        });
      }

      const result = await mapsService.geocode(address.trim());

      res.json({
        success: true,
        result: {
          address: result.formatted_address,
          location: {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng
          },
          placeId: result.place_id,
          types: result.types,
          addressComponents: result.address_components
        }
      });

    } catch (error) {
      console.error('Error en geocodificación:', error);
      
      if (error.message.includes('ZERO_RESULTS')) {
        return res.status(404).json({
          success: false,
          error: 'No se encontraron resultados para la dirección proporcionada'
        });
      }
      
      if (error.message.includes('OVER_QUERY_LIMIT')) {
        return res.status(429).json({
          success: false,
          error: 'Límite de consultas excedido. Intenta más tarde.'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error en el servicio de geocodificación'
      });
    }
  }

  // Geocodificación inversa (coordenadas a dirección)
  async reverseGeocode(req, res) {
    try {
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Latitud y longitud son requeridas'
        });
      }

      if (latitude < -90 || latitude > 90) {
        return res.status(400).json({
          success: false,
          error: 'Latitud inválida (debe estar entre -90 y 90)'
        });
      }

      if (longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          error: 'Longitud inválida (debe estar entre -180 y 180)'
        });
      }

      const result = await mapsService.reverseGeocode(
        parseFloat(latitude), 
        parseFloat(longitude)
      );

      res.json({
        success: true,
        result: {
          address: result.formatted_address,
          location: {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng
          },
          placeId: result.place_id,
          types: result.types,
          addressComponents: result.address_components
        }
      });

    } catch (error) {
      console.error('Error en geocodificación inversa:', error);
      
      if (error.message.includes('ZERO_RESULTS')) {
        return res.status(404).json({
          success: false,
          error: 'No se encontró dirección para las coordenadas proporcionadas'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error en el servicio de geocodificación inversa'
      });
    }
  }

  // Calcular direcciones/rutas
  async getDirections(req, res) {
    try {
      const { origin, destination, options = {} } = req.body;

      if (!origin || !destination) {
        return res.status(400).json({
          success: false,
          error: 'Origen y destino son requeridos'
        });
      }

      // Validar formato de origen y destino
      const validateLocation = (location, name) => {
        if (typeof location === 'string') {
          return location.trim().length >= 3;
        }
        if (typeof location === 'object' && location.lat && location.lng) {
          return location.lat >= -90 && location.lat <= 90 &&
                 location.lng >= -180 && location.lng <= 180;
        }
        return false;
      };

      if (!validateLocation(origin, 'origen')) {
        return res.status(400).json({
          success: false,
          error: 'Formato de origen inválido'
        });
      }

      if (!validateLocation(destination, 'destino')) {
        return res.status(400).json({
          success: false,
          error: 'Formato de destino inválido'
        });
      }

      // Opciones por defecto
      const directionsOptions = {
        mode: options.mode || 'driving',
        avoidHighways: options.avoidHighways || false,
        avoidTolls: options.avoidTolls || false,
        avoidFerries: options.avoidFerries || false,
        optimize: options.optimize || false,
        language: options.language || 'es',
        region: options.region || 'AR',
        ...options
      };

      const result = await mapsService.getDirections(origin, destination, directionsOptions);

      // Procesar resultado
      const route = result.routes[0];
      const leg = route.legs[0];

      res.json({
        success: true,
        result: {
          distance: {
            text: leg.distance.text,
            value: leg.distance.value
          },
          duration: {
            text: leg.duration.text,
            value: leg.duration.value
          },
          startAddress: leg.start_address,
          endAddress: leg.end_address,
          startLocation: {
            latitude: leg.start_location.lat,
            longitude: leg.start_location.lng
          },
          endLocation: {
            latitude: leg.end_location.lat,
            longitude: leg.end_location.lng
          },
          steps: leg.steps.map(step => ({
            distance: step.distance,
            duration: step.duration,
            instructions: step.html_instructions.replace(/<[^>]*>/g, ''), // Remover HTML
            maneuver: step.maneuver,
            startLocation: {
              latitude: step.start_location.lat,
              longitude: step.start_location.lng
            },
            endLocation: {
              latitude: step.end_location.lat,
              longitude: step.end_location.lng
            }
          })),
          polyline: route.overview_polyline.points,
          bounds: {
            northeast: {
              latitude: route.bounds.northeast.lat,
              longitude: route.bounds.northeast.lng
            },
            southwest: {
              latitude: route.bounds.southwest.lat,
              longitude: route.bounds.southwest.lng
            }
          },
          warnings: route.warnings || [],
          copyrights: route.copyrights
        }
      });

    } catch (error) {
      console.error('Error calculando direcciones:', error);
      
      if (error.message.includes('NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: 'No se pudo encontrar una ruta entre los puntos especificados'
        });
      }
      
      if (error.message.includes('ZERO_RESULTS')) {
        return res.status(404).json({
          success: false,
          error: 'No se encontraron rutas disponibles'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error calculando direcciones'
      });
    }
  }

  // Matriz de distancias
  async getDistanceMatrix(req, res) {
    try {
      const { origins, destinations, options = {} } = req.body;

      if (!origins || !destinations || !Array.isArray(origins) || !Array.isArray(destinations)) {
        return res.status(400).json({
          success: false,
          error: 'Orígenes y destinos deben ser arrays'
        });
      }

      if (origins.length === 0 || destinations.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe proporcionar al menos un origen y un destino'
        });
      }

      if (origins.length > 25 || destinations.length > 25) {
        return res.status(400).json({
          success: false,
          error: 'Máximo 25 orígenes y 25 destinos permitidos'
        });
      }

      const matrixOptions = {
        mode: options.mode || 'driving',
        avoidHighways: options.avoidHighways || false,
        avoidTolls: options.avoidTolls || false,
        language: options.language || 'es',
        region: options.region || 'AR',
        ...options
      };

      const result = await mapsService.getDistanceMatrix(origins, destinations, matrixOptions);

      // Procesar resultado
      const processedResult = {
        originAddresses: result.origin_addresses,
        destinationAddresses: result.destination_addresses,
        rows: result.rows.map((row, originIndex) => ({
          originIndex,
          elements: row.elements.map((element, destinationIndex) => ({
            destinationIndex,
            status: element.status,
            distance: element.distance || null,
            duration: element.duration || null,
            durationInTraffic: element.duration_in_traffic || null
          }))
        }))
      };

      res.json({
        success: true,
        result: processedResult
      });

    } catch (error) {
      console.error('Error calculando matriz de distancias:', error);
      res.status(500).json({
        success: false,
        error: 'Error calculando matriz de distancias'
      });
    }
  }

  // Buscar lugares cercanos
  async getNearbyPlaces(req, res) {
    try {
      const { location, options = {} } = req.body;

      if (!location || !location.latitude || !location.longitude) {
        return res.status(400).json({
          success: false,
          error: 'Ubicación con latitud y longitud requerida'
        });
      }

      const searchOptions = {
        radius: options.radius || 1000,
        type: options.type || null,
        keyword: options.keyword || null,
        language: options.language || 'es',
        minprice: options.minprice || null,
        maxprice: options.maxprice || null,
        opennow: options.opennow || false,
        ...options
      };

      const result = await mapsService.getNearbyPlaces(location, searchOptions);

      res.json({
        success: true,
        result: {
          places: result.results.map(place => ({
            placeId: place.place_id,
            name: place.name,
            vicinity: place.vicinity,
            location: {
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng
            },
            rating: place.rating || null,
            priceLevel: place.price_level || null,
            types: place.types,
            openingHours: place.opening_hours || null,
            photos: place.photos ? place.photos.map(photo => ({
              reference: photo.photo_reference,
              width: photo.width,
              height: photo.height
            })) : []
          })),
          nextPageToken: result.next_page_token || null
        }
      });

    } catch (error) {
      console.error('Error buscando lugares cercanos:', error);
      res.status(500).json({
        success: false,
        error: 'Error buscando lugares cercanos'
      });
    }
  }

  // Obtener detalles de un lugar
  async getPlaceDetails(req, res) {
    try {
      const { placeId } = req.params;
      const { fields, language = 'es' } = req.query;

      if (!placeId) {
        return res.status(400).json({
          success: false,
          error: 'Place ID requerido'
        });
      }

      const options = {
        fields: fields ? fields.split(',') : [
          'place_id', 'name', 'formatted_address', 'geometry',
          'rating', 'user_ratings_total', 'price_level',
          'opening_hours', 'formatted_phone_number', 'website',
          'photos', 'reviews', 'types'
        ],
        language
      };

      const result = await mapsService.getPlaceDetails(placeId, options);

      res.json({
        success: true,
        result: {
          placeId: result.place_id,
          name: result.name,
          formattedAddress: result.formatted_address,
          location: result.geometry ? {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng
          } : null,
          rating: result.rating || null,
          userRatingsTotal: result.user_ratings_total || null,
          priceLevel: result.price_level || null,
          openingHours: result.opening_hours || null,
          formattedPhoneNumber: result.formatted_phone_number || null,
          website: result.website || null,
          photos: result.photos ? result.photos.map(photo => ({
            reference: photo.photo_reference,
            width: photo.width,
            height: photo.height
          })) : [],
          reviews: result.reviews || [],
          types: result.types || []
        }
      });

    } catch (error) {
      console.error('Error obteniendo detalles del lugar:', error);
      
      if (error.message.includes('NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          error: 'Lugar no encontrado'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error obteniendo detalles del lugar'
      });
    }
  }

  // Optimizar ruta con múltiples puntos
  async optimizeRoute(req, res) {
    try {
      const { origin, destination, waypoints, options = {} } = req.body;

      if (!origin || !destination) {
        return res.status(400).json({
          success: false,
          error: 'Origen y destino son requeridos'
        });
      }

      if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Puntos intermedios requeridos para optimización'
        });
      }

      if (waypoints.length > 23) {
        return res.status(400).json({
          success: false,
          error: 'Máximo 23 puntos intermedios permitidos'
        });
      }

      const optimizeOptions = {
        mode: options.mode || 'driving',
        optimize: true,
        avoidHighways: options.avoidHighways || false,
        avoidTolls: options.avoidTolls || false,
        language: options.language || 'es',
        region: options.region || 'AR',
        ...options
      };

      const result = await mapsService.optimizeRoute(origin, destination, waypoints, optimizeOptions);

      const route = result.routes[0];
      
      res.json({
        success: true,
        result: {
          optimizedOrder: route.waypoint_order,
          totalDistance: {
            text: route.legs.reduce((total, leg) => total + leg.distance.value, 0) + ' m',
            value: route.legs.reduce((total, leg) => total + leg.distance.value, 0)
          },
          totalDuration: {
            text: Math.floor(route.legs.reduce((total, leg) => total + leg.duration.value, 0) / 60) + ' min',
            value: route.legs.reduce((total, leg) => total + leg.duration.value, 0)
          },
          legs: route.legs.map(leg => ({
            distance: leg.distance,
            duration: leg.duration,
            startAddress: leg.start_address,
            endAddress: leg.end_address,
            startLocation: {
              latitude: leg.start_location.lat,
              longitude: leg.start_location.lng
            },
            endLocation: {
              latitude: leg.end_location.lat,
              longitude: leg.end_location.lng
            }
          })),
          polyline: route.overview_polyline.points,
          bounds: {
            northeast: {
              latitude: route.bounds.northeast.lat,
              longitude: route.bounds.northeast.lng
            },
            southwest: {
              latitude: route.bounds.southwest.lat,
              longitude: route.bounds.southwest.lng
            }
          }
        }
      });

    } catch (error) {
      console.error('Error optimizando ruta:', error);
      res.status(500).json({
        success: false,
        error: 'Error optimizando ruta'
      });
    }
  }

  // Calcular distancia entre dos puntos
  async calculateDistance(req, res) {
    try {
      const { point1, point2 } = req.body;

      if (!point1 || !point2 || 
          !point1.latitude || !point1.longitude ||
          !point2.latitude || !point2.longitude) {
        return res.status(400).json({
          success: false,
          error: 'Dos puntos con latitud y longitud son requeridos'
        });
      }

      const distance = mapsService.calculateDistance(
        point1.latitude, point1.longitude,
        point2.latitude, point2.longitude
      );

      res.json({
        success: true,
        result: {
          distance: {
            meters: Math.round(distance),
            kilometers: Math.round(distance / 1000 * 100) / 100,
            text: distance < 1000 
              ? `${Math.round(distance)} m`
              : `${Math.round(distance / 1000 * 100) / 100} km`
          },
          point1: {
            latitude: point1.latitude,
            longitude: point1.longitude
          },
          point2: {
            latitude: point2.latitude,
            longitude: point2.longitude
          }
        }
      });

    } catch (error) {
      console.error('Error calculando distancia:', error);
      res.status(500).json({
        success: false,
        error: 'Error calculando distancia'
      });
    }
  }

  // Verificar si un punto está dentro de un radio
  async checkWithinRadius(req, res) {
    try {
      const { center, point, radius } = req.body;

      if (!center || !point || !radius ||
          !center.latitude || !center.longitude ||
          !point.latitude || !point.longitude) {
        return res.status(400).json({
          success: false,
          error: 'Centro, punto y radio son requeridos'
        });
      }

      if (radius <= 0 || radius > 100000) {
        return res.status(400).json({
          success: false,
          error: 'Radio debe estar entre 1 y 100000 metros'
        });
      }

      const distance = mapsService.calculateDistance(
        center.latitude, center.longitude,
        point.latitude, point.longitude
      );

      const isWithin = distance <= radius;

      res.json({
        success: true,
        result: {
          isWithinRadius: isWithin,
          distance: {
            meters: Math.round(distance),
            text: distance < 1000 
              ? `${Math.round(distance)} m`
              : `${Math.round(distance / 1000 * 100) / 100} km`
          },
          radius: {
            meters: radius,
            text: radius < 1000 
              ? `${radius} m`
              : `${radius / 1000} km`
          },
          center: {
            latitude: center.latitude,
            longitude: center.longitude
          },
          point: {
            latitude: point.latitude,
            longitude: point.longitude
          }
        }
      });

    } catch (error) {
      console.error('Error verificando radio:', error);
      res.status(500).json({
        success: false,
        error: 'Error verificando radio'
      });
    }
  }
}

module.exports = new MapsController();

