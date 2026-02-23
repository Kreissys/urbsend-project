import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Check, CheckCheck, Wifi, WifiOff } from 'lucide-react';
import { useChat } from '../hooks/useChat';

export default function ChatWidget({ orderId, userType, recipientName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);

  const {
    messages,
    isConnected,
    isTyping,
    unreadCount,
    connectionError,
    sendMessage,
    markAsRead,
    emitTyping,
    emitStopTyping
  } = useChat(orderId, userType);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Marcar como leído y enfocar input al abrir
  useEffect(() => {
    if (isOpen) {
      markAsRead();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, markAsRead]);

  // Enviar mensaje
  const handleSend = () => {
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
      emitStopTyping();
    }
  };

  // Manejar cambio de input
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    emitTyping();

    // Dejar de mostrar "escribiendo" después de 2 segundos
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      emitStopTyping();
    }, 2000);
  };

  // Enviar con Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Formatear hora
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ========== BOTÓN FLOTANTE ==========
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: 'clamp(15px, 4vw, 25px)',
          right: 'clamp(15px, 4vw, 25px)',
          width: 'clamp(50px, 12vw, 65px)',
          height: 'clamp(50px, 12vw, 65px)',
          borderRadius: '50%',
          background: isConnected ? '#D71920' : '#6b7280',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 20px rgba(215, 25, 32, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <MessageCircle size={26} />

        {/* Badge de mensajes no leídos */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#2C3E50',
            color: 'white',
            borderRadius: '50%',
            minWidth: '22px',
            height: '22px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  // ========== VENTANA DE CHAT ==========
  return (
    <div style={{
      position: 'fixed',
      bottom: 'clamp(10px, 3vw, 20px)',
      right: 'clamp(10px, 3vw, 20px)',
      width: 'clamp(300px, 90vw, 380px)',
      height: 'clamp(400px, 70vh, 500px)',
      background: 'white',
      borderRadius: '16px',
      boxShadow: '0 10px 50px rgba(0,0,0,0.25)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      overflow: 'hidden'
    }}>

      {/* ========== HEADER ========== */}
      <div style={{
        background: '#D71920',
        color: 'white',
        padding: 'clamp(12px, 3vw, 18px) clamp(15px, 4vw, 20px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{
            fontWeight: 'bold',
            fontSize: 'clamp(0.95rem, 3vw, 1.1rem)'
          }}>
            Chat con {recipientName}
          </div>
          <div style={{
            fontSize: 'clamp(0.7rem, 2vw, 0.75rem)',
            opacity: 0.9,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            marginTop: '2px'
          }}>
            {isConnected ? (
              <>
                <Wifi size={12} />
                Conectado
              </>
            ) : (
              <>
                <WifiOff size={12} />
                {connectionError || 'Conectando...'}
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
        >
          <X size={20} color="white" />
        </button>
      </div>

      {/* ========== MENSAJES ========== */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'clamp(10px, 3vw, 15px)',
        background: '#f8f9fa'
      }}>
        {/* Sin mensajes */}
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#999',
            marginTop: '50%',
            transform: 'translateY(-50%)'
          }}>
            <MessageCircle size={40} color="#ddd" style={{ marginBottom: '10px' }} />
            <div style={{ fontSize: '0.9rem' }}>Inicia la conversación</div>
            <div style={{ fontSize: '0.75rem', marginTop: '5px' }}>
              Los mensajes son privados
            </div>
          </div>
        )}

        {/* Lista de mensajes */}
        {messages.map((msg, idx) => {
          const isMe = msg.sender === userType;

          return (
            <div
              key={msg.id || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
                marginBottom: '10px'
              }}
            >
              {/* Burbuja del mensaje */}
              <div style={{
                maxWidth: '80%',
                padding: 'clamp(8px, 2vw, 12px) clamp(12px, 3vw, 16px)',
                borderRadius: isMe
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                background: isMe ? '#D71920' : 'white',
                color: isMe ? 'white' : '#333',
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                wordBreak: 'break-word',
                fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)'
              }}>
                {msg.content}
              </div>

              {/* Hora y estado */}
              <div style={{
                fontSize: 'clamp(0.6rem, 1.8vw, 0.7rem)',
                color: '#999',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {formatTime(msg.timestamp)}
                {isMe && (
                  msg.read
                    ? <CheckCheck size={14} color="#22c55e" />
                    : <Check size={14} color="#999" />
                )}
              </div>
            </div>
          );
        })}

        {/* Indicador de "escribiendo" */}
        {isTyping && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#666',
            fontSize: '0.85rem',
            fontStyle: 'italic',
            marginTop: '5px'
          }}>
            <div style={{
              display: 'flex',
              gap: '3px'
            }}>
              <span className="typing-dot" style={{ animationDelay: '0s' }}>•</span>
              <span className="typing-dot" style={{ animationDelay: '0.2s' }}>•</span>
              <span className="typing-dot" style={{ animationDelay: '0.4s' }}>•</span>
            </div>
            {recipientName} está escribiendo...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ========== INPUT ========== */}
      <div style={{
        padding: 'clamp(10px, 3vw, 15px)',
        borderTop: '1px solid #e5e7eb',
        background: 'white',
        display: 'flex',
        gap: '10px',
        alignItems: 'center'
      }}>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Escribe un mensaje..."
          disabled={!isConnected}
          style={{
            flex: 1,
            padding: 'clamp(10px, 2.5vw, 14px) clamp(14px, 3vw, 18px)',
            border: '1px solid #e5e7eb',
            borderRadius: '24px',
            fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
            outline: 'none',
            marginBottom: 0,
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#D71920'}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />

        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || !isConnected}
          style={{
            width: 'clamp(40px, 10vw, 48px)',
            height: 'clamp(40px, 10vw, 48px)',
            borderRadius: '50%',
            background: (inputValue.trim() && isConnected) ? '#D71920' : '#e5e7eb',
            border: 'none',
            cursor: (inputValue.trim() && isConnected) ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
        >
          <Send
            size={18}
            color={(inputValue.trim() && isConnected) ? 'white' : '#999'}
          />
        </button>
      </div>

      {/* Estilos para animación de typing */}
      <style>{`
        .typing-dot {
          animation: typingBounce 1s infinite;
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
