import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../auth/AuthContext';
import ChatList from '../../components/Chat/ChatList';
import ChatWindow from '../../components/Chat/ChatWindow';
import '../../styles/Chat.css';

const InstructorChat = () => {
    const { socket, dbUser, unreadCounts, handleSetActiveChat, markChatRead } = useSocket();
    const { userRole } = useAuth();
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Fetch Chats + Available Students
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

                // Get all students
                const studentsRes = await api.get('/api/chats/available-students');
                const allStudents = studentsRes.data;

                // Merge: existing chats + students without chats
                const mergedChats = [...existingChats];
                allStudents.forEach(student => {
                    const alreadyExists = existingChats.some(c => c.recipientId === student.user_id);
                    if (!alreadyExists) {
                        mergedChats.push({
                            id: `new_${student.user_id}`,
                            recipientName: student.full_name,
                            recipientId: student.user_id,
                            lastMessage: 'Start a conversation',
                            unread: 0,
                            exists: false
                        });
                    }
                });

                setChats(mergedChats);
            } catch (err) {
                console.error("Fetch chats error:", err);
            }
        };
        fetchData();
    }, [unreadCounts]); // Refresh when unread counts change

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

                const studentsRes = await api.get('/api/chats/available-students');
                const allStudents = studentsRes.data;

                const mergedChats = [...existingChats];
                allStudents.forEach(student => {
                    const alreadyExists = existingChats.some(c => c.recipientId === student.user_id);
                    if (!alreadyExists) {
                        mergedChats.push({
                            id: `new_${student.user_id}`,
                            recipientName: student.full_name,
                            recipientId: student.user_id,
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
                console.error("File upload error:", err);
                alert("File upload failed");
                return;
            }
        }

        const tempId = Date.now();
        const optimisticMsg = {
            message_id: tempId,
            text,
            isMyMessage: true,
            created_at: new Date().toISOString(),
            attachment_file_id: attachmentFileId,
            attachment_name: attachmentName,
            attachment_type: attachmentType,
            attachment_url: attachmentUrl
        };
        setMessages(prev => [...prev, optimisticMsg]);

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
        <div className="instructor-chat-page p-4">
            <h2 className="text-2xl font-bold mb-4">Instructor Chat</h2>
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

export default InstructorChat;
