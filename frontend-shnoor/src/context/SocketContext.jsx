import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import api from '../api/axios';
import { useAuth } from '../auth/AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [dbUser, setDbUser] = useState(null);
    const [notificationPermission, setNotificationPermission] = useState('default');

    const { currentUser } = useAuth();
    const activeChatRef = useRef(null);

    // Initialize Socket
    useEffect(() => {
        const API_URL = 'http://localhost:5000';
        const newSocket = io(API_URL, {
            withCredentials: true
        });
        setSocket(newSocket);

        return () => newSocket.close();
    }, []);

    // Request Browser Notification Permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('🔔 Notification permission:', permission);
                setNotificationPermission(permission);
            });
        } else if ('Notification' in window) {
            console.log('🔔 Current notification permission:', Notification.permission);
            setNotificationPermission(Notification.permission);
        }
    }, []);

    // Fetch DB User ID & Join Room
    useEffect(() => {
        if (!socket || !currentUser) return;

        const initUser = async () => {
            try {
                const res = await api.get('/api/users/me');
                setDbUser(res.data);
                console.log('✅ DB User loaded:', res.data);

                // Join User Room
                socket.emit('join_user', res.data.id);

                // Fetch Unread Counts
                fetchUnreadCounts();

            } catch (error) {
                console.error("❌ Failed to init chat user:", error);
            }
        };

        const fetchUnreadCounts = async () => {
            try {
                const res = await api.get('/api/chats');
                const counts = {};
                res.data.forEach(chat => {
                    if (chat.unread_count > 0) {
                        counts[chat.chat_id] = chat.unread_count;
                    }
                });
                setUnreadCounts(counts);
                console.log('📊 Unread counts loaded:', counts);
            } catch (err) {
                console.error("Failed to fetch unread counts", err);
            }
        };

        initUser();

        // Listen for Notifications
        const handleNotification = (notifData) => {
            console.log('🔔 Notification received:', notifData);
            const { chat_id, sender_name, text, sender_id } = notifData;

            // Don't notify if this is the active chat
            if (activeChatRef.current === chat_id) {
                console.log('⏭️ Skipping notification - chat is active');
                return;
            }

            // Don't notify if we sent this message (using current dbUser state)
            if (sender_id === dbUser?.id) {
                console.log('⏭️ Skipping notification - we sent this message');
                return;
            }

            console.log('✅ Processing notification for chat:', chat_id);

            // Play Sound
            try {
                const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
                audio.play().catch((err) => {
                    console.log('🔇 Sound play failed:', err);
                });
            } catch (e) {
                console.error('🔇 Sound error:', e);
            }

            // Browser Notification
            const canShowNotification = 'Notification' in window && Notification.permission === 'granted';
            console.log('🔔 Can show notification:', canShowNotification, 'Document hidden:', document.hidden);

            if (canShowNotification) {
                try {
                    const notification = new Notification(sender_name, {
                        body: text || 'New message',
                        icon: '/logo.png',
                        tag: chat_id,
                        requireInteraction: false
                    });

                    console.log('🔔 Browser notification created');

                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                    };

                    // Auto close after 5 seconds
                    setTimeout(() => notification.close(), 5000);
                } catch (e) {
                    console.error("🔔 Notification error:", e);
                }
            }

            // Update Unread Count
            setUnreadCounts(prev => {
                const newCounts = {
                    ...prev,
                    [chat_id]: (prev[chat_id] || 0) + 1
                };
                console.log('📊 Updated unread counts:', newCounts);
                return newCounts;
            });
        };

        socket.on('new_notification', handleNotification);
        console.log('👂 Listening for new_notification events');

        return () => {
            socket.off('new_notification', handleNotification);
        };

    }, [socket, currentUser, dbUser]); // Added dbUser to dependencies

    const handleSetActiveChat = (chatId) => {
        console.log('📌 Active chat set to:', chatId);
        activeChatRef.current = chatId;
    };

    const markChatRead = (chatId) => {
        console.log('✓ Marking chat as read:', chatId);
        setUnreadCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts[chatId];
            return newCounts;
        });
    };

    const value = {
        socket,
        dbUser,
        unreadCounts,
        setUnreadCounts,
        markChatRead,
        handleSetActiveChat
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
