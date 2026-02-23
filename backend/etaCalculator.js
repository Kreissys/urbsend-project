/**
 * URBSEND - Calculador de ETA con IA
 * Estima el tiempo de llegada basado en múltiples factores
 */

// ============ FACTORES DE TRÁFICO POR HORA ============
const TRAFFIC_FACTORS = {
  MORNING_RUSH: { start: 7, end: 9, factor: 1.4 },      // Hora pico mañana
  LUNCH_TIME: { start: 12, end: 14, factor: 1.25 },    // Hora de almuerzo
  EVENING_RUSH: { start: 17, end: 20, factor: 1.5 },   // Hora pico tarde
  NIGHT: { start: 22, end: 6, factor: 0.8 },           // Noche (menos tráfico)
  DEFAULT: 1.0
};

// ============ FACTORES POR ZONA DE AREQUIPA ============
const ZONE_FACTORS = {
  centro: 1.35,        // Centro histórico - mucha congestión
  miraflores: 1.2,     // Zona comercial
  cayma: 1.15,         // Residencial con tráfico
  yanahuara: 1.1,      // Residencial
  cerro_colorado: 1.25, // Zona en crecimiento
  sachaca: 1.1,
  socabaya: 1.15,
  hunter: 1.2,
  default: 1.0
};

// ============ ZONAS GEOGRÁFICAS DE AREQUIPA ============
const AREQUIPA_ZONES = [
  { name: 'centro', minLat: -16.410, maxLat: -16.395, minLng: -71.545, maxLng: -71.525 },
  { name: 'miraflores', minLat: -16.395, maxLat: -16.380, minLng: -71.545, maxLng: -71.530 },
  { name: 'yanahuara', minLat: -16.395, maxLat: -16.385, minLng: -71.555, maxLng: -71.540 },
  { name: 'cayma', minLat: -16.385, maxLat: -16.370, minLng: -71.560, maxLng: -71.540 },
  { name: 'cerro_colorado', minLat: -16.380, maxLat: -16.350, minLng: -71.590, maxLng: -71.560 },
  { name: 'sachaca', minLat: -16.430, maxLat: -16.410, minLng: -71.580, maxLng: -71.555 },
  { name: 'socabaya', minLat: -16.450, maxLat: -16.420, minLng: -71.540, maxLng: -71.510 },
  { name: 'hunter', minLat: -16.435, maxLat: -16.415, minLng: -71.555, maxLng: -71.535 }
];

/**
 * Detecta la zona geográfica basada en coordenadas
 */
function detectZone(lat, lng) {
  for (const zone of AREQUIPA_ZONES) {
    if (lat >= zone.minLat && lat <= zone.maxLat &&
        lng >= zone.minLng && lng <= zone.maxLng) {
      return zone.name;
    }
  }
  return 'default';
}

/**
 * Obtiene el factor de tráfico según la hora actual
 */
function getTrafficFactor(hour) {
  // Hora pico mañana (7-9am)
  if (hour >= TRAFFIC_FACTORS.MORNING_RUSH.start && hour < TRAFFIC_FACTORS.MORNING_RUSH.end) {
    return TRAFFIC_FACTORS.MORNING_RUSH.factor;
  }
  // Almuerzo (12-14pm)
  if (hour >= TRAFFIC_FACTORS.LUNCH_TIME.start && hour < TRAFFIC_FACTORS.LUNCH_TIME.end) {
    return TRAFFIC_FACTORS.LUNCH_TIME.factor;
  }
  // Hora pico tarde (17-20pm)
  if (hour >= TRAFFIC_FACTORS.EVENING_RUSH.start && hour < TRAFFIC_FACTORS.EVENING_RUSH.end) {
    return TRAFFIC_FACTORS.EVENING_RUSH.factor;
  }
  // Noche (22pm - 6am)
  if (hour >= TRAFFIC_FACTORS.NIGHT.start || hour < TRAFFIC_FACTORS.NIGHT.end) {
    return TRAFFIC_FACTORS.NIGHT.factor;
  }
  return TRAFFIC_FACTORS.DEFAULT;
}

/**
 * Calcula el nivel de confianza de la estimación
 */
function calculateConfidence(distanceKm, hour) {
  let confidence = 0.92;

  // Mayor distancia = menor confianza
  if (distanceKm > 5) confidence -= 0.05;
  if (distanceKm > 10) confidence -= 0.08;
  if (distanceKm > 15) confidence -= 0.10;

  // Hora pico = menor confianza
  if (hour >= 17 && hour < 20) confidence -= 0.12;
  if (hour >= 7 && hour < 9) confidence -= 0.08;

  // Día de semana (lunes=1, domingo=0)
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 5) confidence -= 0.05; // Viernes más impredecible

  return Math.max(0.5, Math.min(0.95, confidence));
}

/**
 * Calcula el ETA inteligente
 * @param {number} osrmDurationSeconds - Duración base de OSRM en segundos
 * @param {object} options - Opciones adicionales
 */
function calculateETA(osrmDurationSeconds, options = {}) {
  const {
    hour = new Date().getHours(),
    destLat = null,
    destLng = null,
    isExpress = false,
    distanceKm = 0
  } = options;

  // Duración base (si no hay OSRM, estimar por distancia)
  let baseDuration = osrmDurationSeconds;
  if (!baseDuration && distanceKm > 0) {
    // Velocidad promedio en ciudad: 20 km/h
    baseDuration = (distanceKm / 20) * 3600;
  }

  // Factor de tráfico por hora
  const trafficFactor = getTrafficFactor(hour);

  // Factor de zona
  const zone = (destLat && destLng) ? detectZone(destLat, destLng) : 'default';
  const zoneFactor = ZONE_FACTORS[zone] || ZONE_FACTORS.default;

  // Factor por tipo de pedido (express = prioridad del conductor)
  const orderFactor = isExpress ? 0.85 : 1.0;

  // Tiempo adicional fijo
  // - Recojo del paquete: 3 min
  // - Búsqueda de dirección: 2 min
  const fixedTimeSeconds = 5 * 60;

  // Cálculo final
  const adjustedDuration = (baseDuration * trafficFactor * zoneFactor * orderFactor) + fixedTimeSeconds;

  // Redondear a minutos (hacia arriba para ser conservador)
  const etaMinutes = Math.ceil(adjustedDuration / 60);

  // Calcular hora de llegada estimada
  const estimatedArrival = new Date(Date.now() + adjustedDuration * 1000);

  // Calcular confianza
  const confidence = calculateConfidence(distanceKm, hour);

  return {
    etaSeconds: Math.round(adjustedDuration),
    etaMinutes,
    estimatedArrival,
    factors: {
      trafficFactor: Math.round(trafficFactor * 100) / 100,
      zoneFactor: Math.round(zoneFactor * 100) / 100,
      orderFactor,
      zone
    },
    confidence: Math.round(confidence * 100),
    baseDurationMinutes: Math.round(baseDuration / 60),
    adjustedDurationMinutes: etaMinutes
  };
}

/**
 * Recalcula ETA basado en ubicación actual del conductor
 * @param {number} currentLat - Latitud actual del conductor
 * @param {number} currentLng - Longitud actual del conductor
 * @param {number} destLat - Latitud destino
 * @param {number} destLng - Longitud destino
 */
function recalculateETAFromLocation(currentLat, currentLng, destLat, destLng, isExpress = false) {
  // Calcular distancia restante usando fórmula de Haversine
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRad(destLat - currentLat);
  const dLng = toRad(destLng - currentLng);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(currentLat)) * Math.cos(toRad(destLat)) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const remainingKm = R * c;

  // Velocidad promedio en ciudad considerando tráfico
  const hour = new Date().getHours();
  const trafficFactor = getTrafficFactor(hour);
  const avgSpeedKmH = 25 / trafficFactor; // 25 km/h base ajustado por tráfico

  // Tiempo restante en minutos
  const remainingMinutes = Math.ceil((remainingKm / avgSpeedKmH) * 60);

  return {
    etaMinutes: Math.max(1, remainingMinutes), // Mínimo 1 minuto
    remainingKm: Math.round(remainingKm * 100) / 100,
    estimatedArrival: new Date(Date.now() + remainingMinutes * 60 * 1000),
    isLive: true
  };
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Formatea el ETA para mostrar al usuario
 */
function formatETA(etaMinutes) {
  if (etaMinutes < 1) return "Llegando...";
  if (etaMinutes === 1) return "1 minuto";
  if (etaMinutes < 60) return `${etaMinutes} minutos`;

  const hours = Math.floor(etaMinutes / 60);
  const mins = etaMinutes % 60;

  if (mins === 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
  return `${hours}h ${mins}min`;
}

module.exports = {
  calculateETA,
  recalculateETAFromLocation,
  detectZone,
  getTrafficFactor,
  formatETA,
  TRAFFIC_FACTORS,
  ZONE_FACTORS
};
