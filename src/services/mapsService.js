const { Client } = require('@googlemaps/google-maps-services-js');

class MapsService {
  constructor() {
    this.client = new Client({});
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️  Google Maps API Key no configurado');
    }
  }

  // Verificar si el servicio está configurado
  isConfigured() {
    return !!this.apiKey;
  }

  // Geocodificación: convertir dirección a coordenadas
  async geocode(address) {
    if (!this.isConfigured()) {
      throw new Error('Google Maps API no está configurado');
    }

    try {
      const response = await this.client.geocode({
        params: {
          address: address,
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          address: result.formatted_address,
          location: {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng
          },
          placeId: result.place_id,
          types: result.types,
          components: result.address_components
        };
      } else {
        throw new Error('No se encontraron resultados para la dirección proporcionada');
      }
    } catch (error) {
      throw new Error('Error en geocodificación: ' + error.message);
    }
  }

  // Geocodificación inversa: convertir coordenadas a dirección
  async reverseGeocode(latitude, longitude) {
    if (!this.isConfigured()) {
      throw new Error('Google Maps API no está configurado');
    }

    try {
      const response = await this.client.reverseGeocode({
        params: {
          latlng: `${latitude},${longitude}`,
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          address: result.formatted_address,
          location: {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng
          },
          placeId: result.place_id,
          types: result.types,
          components: result.address_components
        };
      } else {
        throw new Error('No se encontraron resultados para las coordenadas proporcionadas');
      }
    } catch (error) {
      throw new Error('Error en geocodificación inversa: ' + error.message);
    }
  }

  // Calcular ruta entre dos puntos
  async getDirections(origin, destination, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Google Maps API no está configurado');
    }

    try {
      const params = {
        origin: typeof origin === 'string' ? origin : `${origin.latitude},${origin.longitude}`,
        destination: typeof destination === 'string' ? destination : `${destination.latitude},${destination.longitude}`,
        key: this.apiKey,
        mode: options.mode || 'driving', // driving, walking, bicycling, transit
        alternatives: options.alternatives || true,
        avoid: options.avoid || [], // tolls, highways, ferries, indoor
        units: options.units || 'metric',
        language: options.language || 'es'
      };

      // Agregar waypoints si existen
      if (options.waypoints && options.waypoints.length > 0) {
        params.waypoints = options.waypoints.map(wp => 
          typeof wp === 'string' ? wp : `${wp.latitude},${wp.longitude}`
        ).join('|');
      }

      const response = await this.client.directions({ params });

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        return {
          routes: response.data.routes.map(route => ({
            summary: route.summary,
            distance: route.legs.reduce((total, leg) => total + leg.distance.value, 0),
            duration: route.legs.reduce((total, leg) => total + leg.duration.value, 0),
            distanceText: route.legs.map(leg => leg.distance.text).join(', '),
            durationText: route.legs.map(leg => leg.duration.text).join(', '),
            startAddress: route.legs[0].start_address,
            endAddress: route.legs[route.legs.length - 1].end_address,
            polyline: route.overview_polyline.points,
            bounds: route.bounds,
            legs: route.legs.map(leg => ({
              distance: leg.distance,
              duration: leg.duration,
              startLocation: leg.start_location,
              endLocation: leg.end_location,
              startAddress: leg.start_address,
              endAddress: leg.end_address,
              steps: leg.steps.map(step => ({
                distance: step.distance,
                duration: step.duration,
                instructions: step.html_instructions.replace(/<[^>]*>/g, ''), // Remover HTML
                maneuver: step.maneuver,
                polyline: step.polyline.points,
                startLocation: step.start_location,
                endLocation: step.end_location
              }))
            }))
          })),
          status: response.data.status
        };
      } else {
        throw new Error('No se encontraron rutas para los puntos especificados');
      }
    } catch (error) {
      throw new Error('Error calculando ruta: ' + error.message);
    }
  }

  // Calcular matriz de distancias
  async getDistanceMatrix(origins, destinations, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Google Maps API no está configurado');
    }

    try {
      const formatLocations = (locations) => {
        return locations.map(loc => 
          typeof loc === 'string' ? loc : `${loc.latitude},${loc.longitude}`
        );
      };

      const response = await this.client.distancematrix({
        params: {
          origins: formatLocations(origins),
          destinations: formatLocations(destinations),
          key: this.apiKey,
          mode: options.mode || 'driving',
          units: options.units || 'metric',
          language: options.language || 'es',
          avoid: options.avoid || []
        },
      });

      if (response.data.status === 'OK') {
        return {
          originAddresses: response.data.origin_addresses,
          destinationAddresses: response.data.destination_addresses,
          rows: response.data.rows.map(row => ({
            elements: row.elements.map(element => ({
              distance: element.distance,
              duration: element.duration,
              status: element.status
            }))
          }))
        };
      } else {
        throw new Error('Error en matriz de distancias: ' + response.data.status);
      }
    } catch (error) {
      throw new Error('Error calculando matriz de distancias: ' + error.message);
    }
  }

  // Buscar lugares cercanos
  async searchNearbyPlaces(location, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Google Maps API no está configurado');
    }

    try {
      const response = await this.client.placesNearby({
        params: {
          location: `${location.latitude},${location.longitude}`,
          radius: options.radius || 1000,
          key: this.apiKey,
          type: options.type || 'point_of_interest',
          keyword: options.keyword || '',
          language: options.language || 'es'
        },
      });

      if (response.data.status === 'OK') {
        return {
          places: response.data.results.map(place => ({
            placeId: place.place_id,
            name: place.name,
            vicinity: place.vicinity,
            location: {
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng
            },
            rating: place.rating,
            types: place.types,
            priceLevel: place.price_level,
            photos: place.photos ? place.photos.map(photo => ({
              reference: photo.photo_reference,
              width: photo.width,
              height: photo.height
            })) : [],
            openingHours: place.opening_hours,
            icon: place.icon
          })),
          nextPageToken: response.data.next_page_token
        };
      } else {
        throw new Error('Error buscando lugares: ' + response.data.status);
      }
    } catch (error) {
      throw new Error('Error buscando lugares cercanos: ' + error.message);
    }
  }

  // Obtener detalles de un lugar
  async getPlaceDetails(placeId, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Google Maps API no está configurado');
    }

    try {
      const response = await this.client.placeDetails({
        params: {
          place_id: placeId,
          key: this.apiKey,
          fields: options.fields || [
            'name', 'formatted_address', 'geometry', 'rating', 
            'formatted_phone_number', 'website', 'opening_hours',
            'photos', 'reviews', 'types'
          ].join(','),
          language: options.language || 'es'
        },
      });

      if (response.data.status === 'OK') {
        const place = response.data.result;
        return {
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          location: {
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng
          },
          rating: place.rating,
          phone: place.formatted_phone_number,
          website: place.website,
          types: place.types,
          openingHours: place.opening_hours,
          photos: place.photos ? place.photos.map(photo => ({
            reference: photo.photo_reference,
            width: photo.width,
            height: photo.height
          })) : [],
          reviews: place.reviews ? place.reviews.map(review => ({
            authorName: review.author_name,
            rating: review.rating,
            text: review.text,
            time: review.time
          })) : []
        };
      } else {
        throw new Error('Error obteniendo detalles del lugar: ' + response.data.status);
      }
    } catch (error) {
      throw new Error('Error obteniendo detalles del lugar: ' + error.message);
    }
  }

  // Optimizar ruta con múltiples waypoints
  async optimizeRoute(origin, destination, waypoints, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Google Maps API no está configurado');
    }

    try {
      const waypointsString = waypoints.map(wp => 
        typeof wp === 'string' ? wp : `${wp.latitude},${wp.longitude}`
      ).join('|');

      const response = await this.client.directions({
        params: {
          origin: typeof origin === 'string' ? origin : `${origin.latitude},${origin.longitude}`,
          destination: typeof destination === 'string' ? destination : `${destination.latitude},${destination.longitude}`,
          waypoints: `optimize:true|${waypointsString}`,
          key: this.apiKey,
          mode: options.mode || 'driving',
          language: options.language || 'es'
        },
      });

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        return {
          optimizedOrder: response.data.routes[0].waypoint_order,
          route: {
            summary: route.summary,
            distance: route.legs.reduce((total, leg) => total + leg.distance.value, 0),
            duration: route.legs.reduce((total, leg) => total + leg.duration.value, 0),
            distanceText: route.legs.map(leg => leg.distance.text).join(', '),
            durationText: route.legs.map(leg => leg.duration.text).join(', '),
            polyline: route.overview_polyline.points,
            legs: route.legs
          }
        };
      } else {
        throw new Error('No se pudo optimizar la ruta');
      }
    } catch (error) {
      throw new Error('Error optimizando ruta: ' + error.message);
    }
  }

  // Calcular distancia entre dos puntos (Haversine)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distancia en km
  }

  // Verificar si un punto está dentro de un radio
  isWithinRadius(centerLat, centerLon, pointLat, pointLon, radiusKm) {
    const distance = this.calculateDistance(centerLat, centerLon, pointLat, pointLon);
    return distance <= radiusKm;
  }
}

module.exports = new MapsService();

