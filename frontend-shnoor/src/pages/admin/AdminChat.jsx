// src/pages/admin/AdminChat.jsx
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../auth/AuthContext';
import ChatList from '../../components/Chat/ChatList';
import ChatWindow from '../../components/Chat/ChatWindow';
import '../../styles/Chat.css';

const AdminChat = () => {
    const { socket, dbUser, unreadCounts, handleSetActiveChat, markChatRead } = useSocket();
    const { userRole } = useAuth();
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Fetch existing chats + all available students
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Existing chats
                const chatsRes = await api.get('/api/chats');
                const existing = chatsRes.data.map(c => ({
                    id: c.chat_id,
                    recipientName: c.recipient_name,
                    recipientId: c.recipient_id,
                    lastMessage: c.last_message || 'No messages yet',
                    unread: c.unread_count,
                    exists: true
                }));

                // All students
                const studentsRes = await api.get('/api/chats/available-students'); // reuse same endpoint
                const allStudents = studentsRes.data;

                // Merge: chats + students without chat yet
                const merged = [...existing];
                allStudents.forEach(student => {
                    if (!existing.some(c => c.recipientId === student.user_id)) {
                        merged.push({
                            id: `new_${student.user_id}`,
                            recipientName: student.full_name,
                            recipientId: student.user_id,
                            lastMessage: 'Start a conversation',
                            unread: 0,
                            exists: false
                        });
                    }
                });

                setChats(merged);
            } catch (err) {
                console.error("Admin chat init error:", err);
            }
        };

        fetchData();
    }, [unreadCounts]);

    // Refresh list on new notification (same as instructor)
    useEffect(() => {
        if (!socket) return;
        const refresh = async () => { /* same logic as in InstructorChat */ };
        socket.on('new_notification', refresh);
        return () => socket.off('new_notification', refresh);
    }, [socket]);

    // Receive message (same as instructor)
    useEffect(() => {
        if (!socket) return;
        const onReceive = (msg) => {
            if (activeChat?.id === msg.chat_id) {
                setMessages(prev => [...prev, {
                    ...msg,
                    isMyMessage: msg.sender_id === dbUser?.id
                }]);
                api.put('/api/chats/read', { chatId: msg.chat_id });
            }
        };
        socket.on('receive_message', onReceive);
        return () => socket.off('receive_message', onReceive);
    }, [socket, activeChat, dbUser]);

    // Select chat & create if new (same logic)
    const handleSelectChat = async (chat) => {
        handleSetActiveChat(chat.id);
        markChatRead(chat.id);

        let chatId = chat.id;

        // If new chat, create it first
        if (!chat.exists) {
            try {
                const res = await api.post('/api/chats', { recipientId: chat.recipientId });
                chatId = res.data.chat_id;
                chat.id = chatId;
                chat.exists = true;
            } catch (err) {
                console.error("Create chat error:", err);
                return;
            }
        }

        setActiveChat(chat);
        socket.emit('join_chat', chatId);

        setLoadingMessages(true);
        try {
            const res = await api.get(`/api/chats/messages/${chatId}`);
            const uiMessages = res.data.map(m => ({
                ...m,
                isMyMessage: m.sender_id === dbUser?.id
            }));
            setMessages(uiMessages);
            await api.put('/api/chats/read', { chatId: chatId });
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingMessages(false);
        }
    };

    // Send message (same logic)
    const handleSendMessage = async (text, file) => {
  console.log('[SEND DEBUG] handleSendMessage called', { text, file, activeChat });

  if (!socket) {
    console.error('[SEND DEBUG] socket is null or undefined!');
    alert('Chat connection not ready. Please refresh.');
    return;
  }

  if (!activeChat?.id) {
    console.error('[SEND DEBUG] No active chat selected');
    return;
  }

  console.log('[SEND DEBUG] Emitting send_message with chatId:', activeChat.id);

  // ... your existing upload / optimistic UI code ...

  socket.emit('send_message', {
    chatId: activeChat.id,
    text,
    senderId: dbUser?.id,
    senderUid: dbUser?.firebase_uid,
    senderName: dbUser?.fullName,
    recipientId: activeChat.recipientId,
    // attachment fields if any
  });

  console.log('[SEND DEBUG] emit("send_message") was called');
};

    return (
        <div className="admin-chat-page p-4">
            <h2 className="text-2xl font-bold mb-4">Chat with Students</h2>
            <div className="chat-container">
                <ChatList
                    chats={chats}
                    activeChat={activeChat}
                    onSelectChat={handleSelectChat}
                    unreadCounts={unreadCounts}
                />
                <ChatWindow
                    activeChat={activeChat}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    loadingMessages={loadingMessages}
                />
            </div>
        </div>
    );
};

export default AdminChat;