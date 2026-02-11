import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';
import { useAuth } from '../auth/AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();

  const [socket, setSocket] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [socketStatus, setSocketStatus] = useState('disconnected');

  const activeChatRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const socketInitialized = useRef(false); // Prevents re-init loop

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Notification permission (run once)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('🔔 Notification permission:', permission);
        setNotificationPermission(permission);
      });
    } else if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Socket connection + reconnection logic
  useEffect(() => {
    if (authLoading || !currentUser || socketInitialized.current) {
      return;
    }

    socketInitialized.current = true; // Mark as initialized

    let newSocket = null;

    const connectSocket = async () => {
      try {
        // Use cached token only (no force-refresh = no quota burn)
        const token = await currentUser.getIdToken(); // ← correct: no parameter

        newSocket = io(API_URL, {
          auth: { token },
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
        });

        newSocket.on('connect', () => {
          console.log('[Socket] Connected! ID:', newSocket.id);
          setSocketStatus('connected');
          reconnectAttempts.current = 0;
        });

        newSocket.on('connect_error', (err) => {
          console.error('[Socket] Connection error:', err.message);
          setSocketStatus('error');
          reconnectAttempts.current += 1;

          if (reconnectAttempts.current >= 5) {
            console.warn('[Socket] Max reconnection attempts reached');
          }
        });

        newSocket.on('disconnect', (reason) => {
          console.log('[Socket] Disconnected:', reason);
          setSocketStatus('disconnected');
        });

        setSocket(newSocket);
      } catch (err) {
        console.error('[SocketProvider] Failed to connect:', err.message);
        setSocketStatus('auth-failed');
      }
    };

    connectSocket();

    return () => {
      if (newSocket) {
        console.log('[SocketProvider] Cleaning up socket');
        newSocket.disconnect();
      }
      socketInitialized.current = false; // Reset on unmount
    };
  }, [currentUser, authLoading, API_URL]); // Stable dependencies

  // Initialize user data & unread counts (with retry on 401)
  useEffect(() => {
    if (!socket || !currentUser || authLoading || socketStatus !== 'connected') {
      return;
    }

    const initUser = async (retry = 0) => {
      try {
        const res = await api.get('/api/users/me');
        setDbUser(res.data);
        console.log('✅ DB User loaded:', res.data);

        // Join personal notification room
        socket.emit('join_user', res.data.id);

        // Load unread counts
        await fetchUnreadCounts();
      } catch (error) {
        if (retry < 2 && error.response?.status === 401) {
          console.warn(`Auth failed - retrying in ${retry * 3 + 3}s... (attempt ${retry + 1}/3)`);
          await new Promise(r => setTimeout(r, (retry * 3000) + 3000));
          return initUser(retry + 1);
        }
        console.error('❌ Failed to init chat user:', error);
      }
    };

    const fetchUnreadCounts = async () => {
      try {
        const res = await api.get('/api/chats');
        const counts = {};
        res.data.forEach((chat) => {
          if (chat.unread_count > 0) {
            counts[chat.chat_id] = chat.unread_count;
          }
        });
        setUnreadCounts(counts);
        console.log('📊 Unread counts loaded:', counts);
      } catch (err) {
        console.error('Failed to fetch unread counts:', err);
      }
    };

    initUser();

    // Real-time notification listener
    const handleNotification = (notifData) => {
      const { chat_id, sender_name, text, sender_id } = notifData;

      // Skip if current chat or self-sent
      if (activeChatRef.current === chat_id || sender_id === dbUser?.id) {
        return;
      }

      // Play sound
      try {
        const audio = new Audio(
          'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
        );
        audio.play().catch(e => console.log('Sound play failed:', e));
      } catch (e) {
        console.error('Sound error:', e);
      }

      // Browser notification
      if (Notification.permission === 'granted') {
        try {
          const notification = new Notification(sender_name, {
            body: text || 'New message',
            icon: '/logo.png',
            tag: chat_id,
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };

          setTimeout(() => notification.close(), 5000);
        } catch (e) {
          console.error('Notification error:', e);
        }
      }

      // Increment unread count
      setUnreadCounts(prev => ({
        ...prev,
        [chat_id]: (prev[chat_id] || 0) + 1,
      }));
    };

    socket.on('new_notification', handleNotification);

    return () => {
      socket.off('new_notification', handleNotification);
    };
  }, [socket, currentUser, authLoading, socketStatus]);

  const handleSetActiveChat = useCallback((chatId) => {
    console.log('📌 Active chat set to:', chatId);
    activeChatRef.current = chatId;
  }, []);

  const markChatRead = useCallback((chatId) => {
    console.log('✓ Marking chat as read:', chatId);
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[chatId];
      return newCounts;
    });
  }, []);

  const value = useMemo(
    () => ({
      socket,
      dbUser,
      unreadCounts,
      setUnreadCounts,
      markChatRead,
      handleSetActiveChat,
      socketStatus,
    }),
    [socket, dbUser, unreadCounts, socketStatus]
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};