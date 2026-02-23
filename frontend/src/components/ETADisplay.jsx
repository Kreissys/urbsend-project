import React, { useState, useEffect } from 'react';
import { Clock, Truck, MapPin, Zap } from 'lucide-react';

export default function ETADisplay({ orderId, status, isExpress }) {
  const [eta, setEta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Solo mostrar ETA para estados activos
    const normalizedStatus = status?.toUpperCase().replace(/\s+/g, '_');
    if (!['ASIGNADO', 'EN_CAMINO'].includes(normalizedStatus)) {
      setLoading(false);
      return;
    }

    const fetchETA = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/eta`);
        if (res.ok) {
          const data = await res.json();
          setEta(data);
          setError(null);
        } else {
          setError('No disponible');
        }
      } catch (e) {
        console.error("Error fetching ETA:", e);
        setError('Error de conexión');
      }
      setLoading(false);
    };

    fetchETA();

    // Actualizar cada 30 segundos
    const interval = setInterval(fetchETA, 30000);
    return () => clearInterval(interval);
  }, [orderId, status]);

  // Estado de carga
  if (loading) {
    return (
      <div className="info-card" style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        borderColor: '#7dd3fc',
        marginTop: '15px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          justifyContent: 'center',
          padding: '10px 0'
        }}>
          <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
          <span style={{ color: '#0284c7', fontSize: '0.9rem' }}>
            Calculando tiempo estimado...
          </span>
        </div>
      </div>
    );
  }

  // No mostrar si no hay ETA o hay error
  if (!eta || !eta.etaMinutes || error) {
    return null;
  }

  // Formatear hora de llegada
  const arrivalTime = eta.estimatedArrival
    ? new Date(eta.estimatedArrival).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  // Tiempo desde última actualización de ubicación
  const getTimeSince = (dateString) => {
    if (!dateString) return null;
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return `${seconds} seg`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    return 'hace tiempo';
  };

  const lastUpdate = eta.driverLocation?.updatedAt
    ? getTimeSince(eta.driverLocation.updatedAt)
    : null;

  return (
    <div className="info-card" style={{
      background: isExpress
        ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
        : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      borderColor: isExpress ? '#fcd34d' : '#86efac',
      marginTop: '15px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Badge Express */}
      {isExpress && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: '#f59e0b',
          color: 'white',
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '0.65rem',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '3px'
        }}>
          <Zap size={10} /> EXPRESS
        </div>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '15px'
      }}>
        {/* Información del ETA */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 'clamp(0.7rem, 2vw, 0.8rem)',
            color: isExpress ? '#92400e' : '#166534',
            fontWeight: 'bold',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {eta.isLive ? '🔴 EN VIVO' : 'LLEGADA ESTIMADA'}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px'
          }}>
            <span style={{
              fontSize: 'clamp(2rem, 8vw, 2.5rem)',
              fontWeight: '900',
              color: isExpress ? '#d97706' : '#15803d',
              lineHeight: 1
            }}>
              {eta.etaMinutes}
            </span>
            <span style={{
              fontSize: 'clamp(0.9rem, 3vw, 1.1rem)',
              color: isExpress ? '#92400e' : '#166534',
              fontWeight: '500'
            }}>
              min
            </span>
          </div>

          {arrivalTime && (
            <div style={{
              fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)',
              color: isExpress ? '#92400e' : '#166534',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Clock size={14} />
              Aprox. {arrivalTime}
            </div>
          )}

          {eta.remainingKm && (
            <div style={{
              fontSize: '0.8rem',
              color: '#666',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <MapPin size={14} />
              {eta.remainingKm} km restantes
            </div>
          )}
        </div>

        {/* Icono animado */}
        <div style={{
          width: 'clamp(50px, 15vw, 70px)',
          height: 'clamp(50px, 15vw, 70px)',
          background: isExpress ? '#f59e0b' : '#22c55e',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 15px ${isExpress ? 'rgba(245, 158, 11, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
          animation: eta.isLive ? 'pulse 2s infinite' : 'none'
        }}>
          <Truck size={28} color="white" />
        </div>
      </div>

      {/* Indicador de ubicación en vivo */}
      {eta.isLive && lastUpdate && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: `1px dashed ${isExpress ? '#fcd34d' : '#86efac'}`,
          fontSize: '0.75rem',
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            background: '#22c55e',
            borderRadius: '50%',
            animation: 'pulse 1.5s infinite'
          }}></span>
          Ubicación actualizada hace {lastUpdate}
        </div>
      )}

      {/* Estilos para animación */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
