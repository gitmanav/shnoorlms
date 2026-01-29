import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaPaperclip, FaTimes, FaFileAlt, FaImage, FaVideo, FaSmile } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';

const ChatWindow = ({ activeChat, messages, onSendMessage, loadingMessages }) => {
    const [text, setText] = useState("");
    const [file, setFile] = useState(null);
    const [showEmoji, setShowEmoji] = useState(false);
    const endRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, file]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!text.trim() && !file) return;

        onSendMessage(text, file);

        // Reset
        setText("");
        setFile(null);
        setShowEmoji(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleFileSelect = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    if (!activeChat) {
        return (
            <div className="chat-main no-chat-selected">
                <p>Select a conversation to start chatting.</p>
            </div>
        );
    }

    return (
        <div className="chat-main">
            <div className="chat-header">
                <h3>{activeChat.recipientName}</h3>
            </div>

            <div className="chat-messages" onClick={() => setShowEmoji(false)}>
                {loadingMessages ? (
                    <div style={{ textAlign: 'center', padding: 20 }}>Loading...</div>
                ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: 20 }}>
                        No messages yet. Say Hi!
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <MessageItem key={idx} msg={msg} />
                    ))
                )}
                <div ref={endRef} />
            </div>

            {/* File Preview */}
            {file && (
                <div className="p-2 bg-gray-100 flex items-center justify-between border-t border-gray-200">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{file.name}</span>
                    </div>
                    <button onClick={() => { setFile(null); fileInputRef.current.value = ""; }} className="text-red-500">
                        <FaTimes />
                    </button>
                </div>
            )}

            <div className="chat-input-area relative">
                {showEmoji && (
                    <div className="absolute bottom-16 left-4 z-50">
                        <EmojiPicker onEmojiClick={(em) => setText(prev => prev + em.emoji)} width={300} height={400} />
                    </div>
                )}

                <form className="chat-input-form items-center gap-3" onSubmit={handleSubmit}>
                    <button
                        type="button"
                        className="text-yellow-500 text-xl"
                        onClick={() => setShowEmoji(!showEmoji)}
                    >
                        <FaSmile />
                    </button>

                    <button
                        type="button"
                        className="text-gray-500 text-lg"
                        onClick={() => fileInputRef.current.click()}
                    >
                        <FaPaperclip />
                    </button>
                    <input
                        type="file"
                        hidden
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                    />

                    <input
                        type="text"
                        placeholder="Type a message..."
                        value={text}
                        onChange={e => setText(e.target.value)}
                        className="flex-1"
                    />
                    <button type="submit" className="send-btn" disabled={!text.trim() && !file}>
                        <FaPaperPlane />
                    </button>
                </form>
            </div>
        </div>
    );
};

const MessageItem = ({ msg }) => {
    const isMe = msg.isMyMessage;

    const renderAttachment = () => {
        if (!msg.attachment_url && !msg.attachment_file_id) return null;

        // Prefer explicit URL from backend, else construct it
        const url = msg.attachment_url || `http://localhost:5000/api/files/${msg.attachment_file_id}`;
        const type = msg.attachment_type || 'file'; // fallback

        if (type.includes('image')) {
            return <img src={url} alt="attachment" className="max-w-full rounded-lg mb-2 cursor-pointer max-h-60 object-cover" onClick={() => window.open(url, '_blank')} />;
        }
        if (type.includes('video')) {
            return <video src={url} controls className="max-w-full rounded-lg mb-2 max-h-60" />;
        }
        return (
            <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-gray-100 rounded mb-2 text-blue-600 underline">
                <FaFileAlt /> {msg.attachment_name || "Download File"}
            </a>
        );
    };

    return (
        <div className={`message ${isMe ? 'sent' : 'received'}`}>
            <div className="message-bubble">
                {renderAttachment()}
                {msg.text && <p className="m-0">{msg.text}</p>}
            </div>
            <div className="message-time">
                {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    );
}

export default ChatWindow;
