import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = `${import.meta.env.VITE_API_URL}/chat`;

export function useChat(orderId, userType) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!orderId || !userType) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Conexión establecida
    newSocket.on('connect', () => {
      console.log('✅ Chat conectado');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
      newSocket.emit('join-order', orderId);
    });

    // Desconexión
    newSocket.on('disconnect', (reason) => {
      console.log('❌ Chat desconectado:', reason);
      setIsConnected(false);
    });

    // Error de conexión
    newSocket.on('connect_error', (error) => {
      console.error('Error de conexión:', error);
      reconnectAttempts.current++;
      if (reconnectAttempts.current >= 5) {
        setConnectionError('No se pudo conectar al chat');
      }
    });

    // Historial de mensajes
    newSocket.on('message-history', (history) => {
      setMessages(history);
      // Contar mensajes no leídos del otro participante
      const unread = history.filter(m => m.sender !== userType && !m.read).length;
      setUnreadCount(unread);
    });

    // Nuevo mensaje
    newSocket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
      if (message.sender !== userType) {
        setUnreadCount(prev => prev + 1);
      }
    });

    // Usuario escribiendo
    newSocket.on('user-typing', ({ sender }) => {
      if (sender !== userType) {
        setIsTyping(true);
      }
    });

    // Usuario dejó de escribir
    newSocket.on('user-stop-typing', ({ sender }) => {
      if (sender !== userType) {
        setIsTyping(false);
      }
    });

    // Mensajes marcados como leídos
    newSocket.on('messages-read', ({ by }) => {
      if (by !== userType) {
        // El otro usuario leyó nuestros mensajes
        setMessages(prev => prev.map(m =>
          m.sender === userType ? { ...m, read: true } : m
        ));
      }
    });

    // Error del servidor
    newSocket.on('error', (error) => {
      console.error('Error del chat:', error);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.disconnect();
    };
  }, [orderId, userType]);

  // Enviar mensaje
  const sendMessage = useCallback((content) => {
    if (socket && content.trim()) {
      socket.emit('send-message', {
        orderId,
        sender: userType,
        content: content.trim()
      });
    }
  }, [socket, orderId, userType]);

  // Marcar como leído
  const markAsRead = useCallback(() => {
    if (socket && unreadCount > 0) {
      socket.emit('mark-read', { orderId, sender: userType });
      setUnreadCount(0);
    }
  }, [socket, orderId, userType, unreadCount]);

  // Emitir "escribiendo"
  const emitTyping = useCallback(() => {
    if (socket) {
      socket.emit('typing', { orderId, sender: userType });
    }
  }, [socket, orderId, userType]);

  // Emitir "dejó de escribir"
  const emitStopTyping = useCallback(() => {
    if (socket) {
      socket.emit('stop-typing', { orderId, sender: userType });
    }
  }, [socket, orderId, userType]);

  return {
    messages,
    isConnected,
    isTyping,
    unreadCount,
    connectionError,
    sendMessage,
    markAsRead,
    emitTyping,
    emitStopTyping
  };
}
