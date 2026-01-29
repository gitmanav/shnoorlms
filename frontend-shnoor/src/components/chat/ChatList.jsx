import React from 'react';

const ChatList = ({ chats, activeChat, onSelectChat, unreadCounts }) => {
    return (
        <div className="chat-sidebar">
            <div className="chat-search">
                <input
                    type="text"
                    placeholder="Search contacts..."
                />
            </div>
            <div className="chat-contacts-list">
                {chats.map(chat => {
                    const unreadCount = unreadCounts[chat.id] || 0;
                    const isActive = activeChat?.id === chat.id;

                    return (
                        <div
                            key={chat.id}
                            className={`chat-contact-item ${isActive ? 'active' : ''}`}
                            onClick={() => onSelectChat(chat)}
                        >
                            {/* Avatar with indicator */}
                            <div className="contact-avatar">
                                {chat.recipientName?.charAt(0).toUpperCase() || 'U'}
                                {unreadCount > 0 && !isActive && (
                                    <div className="unread-indicator"></div>
                                )}
                            </div>

                            <div className="contact-info">
                                <div className="contact-header">
                                    <span className="contact-name">{chat.recipientName}</span>
                                    {unreadCount > 0 && !isActive && (
                                        <span className="unread-badge">{unreadCount}</span>
                                    )}
                                </div>
                                <p className="last-message">
                                    {chat.lastMessage || 'No messages yet'}
                                </p>
                            </div>
                        </div>
                    );
                })}
                {chats.length === 0 && (
                    <div className="no-chats">
                        <p>No conversations yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatList;
