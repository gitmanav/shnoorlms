import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../auth/AuthContext';
import ChatList from '../../components/Chat/ChatList';
import ChatWindow from '../../components/Chat/ChatWindow';
import '../../styles/Chat.css';

const StudentChat = () => {
    const { socket, dbUser, unreadCounts, handleSetActiveChat, markChatRead } = useSocket();
    const { userRole } = useAuth();
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Fetch Chats + Available Instructors
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get existing chats
                const chatsRes = await api.get('/api/chats');
                const existingChats = chatsRes.data.map(c => ({
                    id: c.chat_id,
                    recipientName: c.recipient_name,
                    recipientId: c.recipient_id,
                    lastMessage: c.last_message || 'No messages yet',
                    unread: c.unread_count,
                    exists: true
                }));

                // Get all instructors
                const instructorsRes = await api.get('/api/chats/available-instructors');
                const allInstructors = instructorsRes.data;
                // Admin Support Addition
                const adminsRes = await api.get('/api/chats/available-admins');
                const allAdmins = adminsRes.data;
                allAdmins.forEach(admin => {
    const alreadyExists = existingChats.some(c => c.recipientId === admin.user_id);
    if (!alreadyExists) {
        mergedChats.push({
            id: `new_${admin.user_id}`,
            recipientName: admin.full_name || 'Admin Support',
            recipientId: admin.user_id,
            lastMessage: 'Ask support',
            unread: 0,
            exists: false
        });
    }
});
                // Merge: existing chats + instructors without chats
                const mergedChats = [...existingChats];
                allInstructors.forEach(instructor => {
                    const alreadyExists = existingChats.some(c => c.recipientId === instructor.user_id);
                    if (!alreadyExists) {
                        mergedChats.push({
                            id: `new_${instructor.user_id}`,
                            recipientName: instructor.full_name,
                            recipientId: instructor.user_id,
                            lastMessage: 'Start a conversation',
                            unread: 0,
                            exists: false
                        });
                    }
                });

                setChats(mergedChats);
            } catch (err) {
                console.error("Init Student Chat Error:", err);
            }
        };
        fetchData();
    }, [unreadCounts]);

    // Listen for global new_notification to refresh chat list
    useEffect(() => {
        if (!socket) return;

        const handleGlobalNotification = async () => {
            // Refresh chat list to update last message
            try {
                const chatsRes = await api.get('/api/chats');
                const existingChats = chatsRes.data.map(c => ({
                    id: c.chat_id,
                    recipientName: c.recipient_name,
                    recipientId: c.recipient_id,
                    lastMessage: c.last_message || 'No messages yet',
                    unread: c.unread_count,
                    exists: true
                }));

                const instructorsRes = await api.get('/api/chats/available-instructors');
                const allInstructors = instructorsRes.data;

                const mergedChats = [...existingChats];
                allInstructors.forEach(instructor => {
                    const alreadyExists = existingChats.some(c => c.recipientId === instructor.user_id);
                    if (!alreadyExists) {
                        mergedChats.push({
                            id: `new_${instructor.user_id}`,
                            recipientName: instructor.full_name,
                            recipientId: instructor.user_id,
                            lastMessage: 'Start a conversation',
                            unread: 0,
                            exists: false
                        });
                    }
                });

                setChats(mergedChats);
            } catch (err) {
                console.error("Refresh chats error:", err);
            }
        };

        socket.on('new_notification', handleGlobalNotification);
        return () => socket.off('new_notification', handleGlobalNotification);
    }, [socket]);

    // Handle Message Receive
    useEffect(() => {
        if (!socket) return;
        const handleReceive = (msg) => {
            if (activeChat && msg.chat_id === activeChat.id) {
                setMessages(prev => [...prev, {
                    ...msg,
                    isMyMessage: msg.sender_id === dbUser?.id
                }]);
                api.put('/api/chats/read', { chatId: msg.chat_id });
            }
        };
        socket.on('receive_message', handleReceive);
        return () => socket.off('receive_message', handleReceive);
    }, [socket, activeChat, dbUser]);

    // Select Chat
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
            setMessages(res.data.map(m => ({
                ...m,
                isMyMessage: m.sender_id === dbUser?.id
            })));
            await api.put('/api/chats/read', { chatId: chatId });
        } finally {
            setLoadingMessages(false);
        }
    };

    // Send Message
    const handleSendMessage = async (text, file) => {
        let attachmentFileId = null;
        let attachmentName = null;
        let attachmentType = null;
        let attachmentUrl = null;

        if (file) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                const res = await api.post('/api/chats/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                attachmentFileId = res.data.file_id;
                attachmentName = file.name;
                attachmentType = file.type;
                attachmentUrl = URL.createObjectURL(file);
            } catch (err) {
                console.error("Upload failed:", err);
                return;
            }
        }

        const tempId = Date.now();
        setMessages(prev => [...prev, {
            message_id: tempId,
            text,
            isMyMessage: true,
            created_at: new Date().toISOString(),
            attachment_file_id: attachmentFileId,
            attachment_name: attachmentName,
            attachment_type: attachmentType,
            attachment_url: attachmentUrl
        }]);

        socket.emit('send_message', {
            chatId: activeChat.id,
            text,
            senderId: dbUser.id,
            senderUid: dbUser.firebase_uid,
            senderName: dbUser.fullName,
            recipientId: activeChat.recipientId,
            attachment_file_id: attachmentFileId,
            attachment_name: attachmentName,
            attachment_type: attachmentType
        });
    };

    return (
        <div className="student-chat-page p-4">
            <h2 className="text-2xl font-bold mb-4">Student Chat</h2>
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

export default StudentChat;