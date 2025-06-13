import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// The URL should point to the base of the backend server where Socket.IO is running.
const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000';

export function useWebSocket(organizationId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    // Establish connection with Socket.IO server
    const socket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      transports: ['websocket'], // Prefer WebSocket transport
    });
    socketRef.current = socket;

    // --- Event Handlers ---
    socket.on('connect', () => {
      console.log('Socket.IO connected:', socket.id);
      setIsConnected(true);
      // Join a room specific to the organization to receive targeted updates
      socket.emit('join_room', { room: organizationId });
    });

    const createEventHandler = (eventType: string) => (payload: any) => {
      console.log(`Socket.IO event received [${eventType}]:`, payload);
      // Structure the message to be compatible with the component's handler
      setLastMessage({ event_type: eventType, payload });
    };

    // Listen for specific real-time events from the server
    socket.on('incident_created', createEventHandler('incident_created'));
    socket.on('incident_updated', createEventHandler('incident_updated'));
    socket.on('incident_deleted', createEventHandler('incident_deleted'));
    socket.on('service_updated', createEventHandler('service_updated'));

    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      setIsConnected(false);
    });

    // Cleanup on component unmount
    return () => {
      console.log('Cleaning up Socket.IO connection.');
      socket.disconnect();
    };
  }, [organizationId]);

  return { isConnected, lastMessage };
}
