import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, MapPin, MessageCircle, Share2 } from 'lucide-react';
import ETADisplay from '../components/ETADisplay';
import ChatWidget from '../components/ChatWidget';

export default function TrackingView({ trackId, setTrackId, handleTrackOrder, trackedOrder, startSimulation }) {
  const [searchParams] = useSearchParams();

  // Auto-cargar ID desde la URL si viene como parámetro
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl && idFromUrl !== trackId) {
      setTrackId(idFromUrl);
      // Buscar el pedido automáticamente
      setTimeout(() => {
        handleTrackOrder();
      }, 100);
    }
  }, [searchParams]);

  return (
    <div style={{ width: '100%' }}>
      <h2>Rastrear Pedido 🛰️</h2>
      
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input 
            placeholder="Ingresa ID del pedido..." 
            value={trackId} 
            onChange={e=>setTrackId(e.target.value)}
            style={{ marginBottom: 0, flex: 1 }} 
        />
        <button className="btn-icon-only" onClick={handleTrackOrder} style={{ flexShrink: 0 }}>
            <Search size={20}/>
        </button>
      </div>

      {trackedOrder && (() => {
        // Normalizar estado
        const normalizedStatus = trackedOrder.status ? trackedOrder.status.toUpperCase().replace(/\s+/g, '_') : 'PENDIENTE';

        const statusConfig = {
          'PENDIENTE': { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
          'ASIGNADO': { bg: '#DBEAFE', color: '#1E40AF', label: 'Asignado' },
          'EN_CAMINO': { bg: '#E9D5FF', color: '#6B21A8', label: 'En Camino' },
          'ENTREGADO': { bg: '#D1FAE5', color: '#065F46', label: 'Entregado' }
        };

        const status = statusConfig[normalizedStatus] || statusConfig['PENDIENTE'];
        const isEnRoute = normalizedStatus === 'EN_CAMINO';

        return (
          <div className="info-card">
            <div style={{textAlign: 'center', marginBottom: '15px'}}>
              <span style={{
                  background: status.bg,
                  color: status.color,
                  padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem'
              }}>
                  {status.label}
              </span>
            </div>

            <div style={{fontSize:'0.9rem', marginBottom: '15px'}}>
               <div style={{marginBottom: '8px'}}>📍 <b>Origen:</b> {trackedOrder.originAddress}</div>
               <div>🏁 <b>Destino:</b> {trackedOrder.destAddress}</div>
            </div>

            {/* ETA Display - Solo mostrar cuando está asignado o en camino */}
            {(normalizedStatus === 'ASIGNADO' || normalizedStatus === 'EN_CAMINO') && (
              <ETADisplay
                orderId={trackedOrder.id}
                isExpress={trackedOrder.urgency === true || trackedOrder.urgency === 'express'}
              />
            )}

            {isEnRoute && (
              <button className="btn-primary" style={{background: '#8b5cf6'}} onClick={startSimulation}>
                  ▶ VER MOTO EN VIVO
              </button>
            )}

            {trackedOrder.proofImage && (
              <a href={`${import.meta.env.VITE_API_URL}${trackedOrder.proofImage}`} target="_blank" rel="noopener noreferrer"
                 style={{display:'block', marginTop:'15px', color:'#D71920', fontWeight:'bold', textAlign: 'center', textDecoration: 'none', border: '1px solid #D71920', padding: '10px', borderRadius: '8px'}}>
                 📄 VER FOTO DE ENTREGA
              </a>
            )}

            {/* Botón de compartir por WhatsApp */}
            <button
              onClick={() => {
                const statusLabel = status.label;
                const message = `📦 *Mi Pedido URBSEND*\n\n🔖 Estado: *${statusLabel}*\n📍 Origen: ${trackedOrder.originAddress}\n🎯 Destino: ${trackedOrder.destAddress}\n💰 Precio: S/ ${trackedOrder.price?.toFixed(2) || 'N/A'}\n\n📍 Rastrear aquí:\nhttp://localhost:5173/tracking?id=${trackedOrder.id}`;
                const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
                window.open(url, '_blank');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                marginTop: '15px',
                padding: '12px',
                background: '#25D366',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#128C7E';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#25D366';
              }}
            >
              <MessageCircle size={18} /> Compartir Estado
            </button>
          </div>
        );
      })()}

      {/* Chat Widget - Solo mostrar cuando hay pedido y está asignado o en camino */}
      {trackedOrder && ['ASIGNADO', 'EN_CAMINO'].includes(
        trackedOrder.status?.toUpperCase().replace(/\s+/g, '_') || ''
      ) && (
        <ChatWidget
          orderId={trackedOrder.id}
          userType="CLIENT"
          recipientName={trackedOrder.driverName || 'Repartidor'}
        />
      )}
    </div>
  );
}