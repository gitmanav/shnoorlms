import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaPaperclip, FaTimes, FaFileAlt, FaSmile } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';

const ChatWindow = ({ activeChat, messages, onSendMessage, loadingMessages }) => {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  const isGroup = activeChat?.type === 'group';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, file]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() && !file) return;

    onSendMessage(text, file);

    // Reset form
    setText("");
    setFile(null);
    setShowEmoji(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  if (!activeChat) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Select a conversation to start chatting</p>
          <p className="text-sm mt-2">Choose someone from the list or create a group</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="chat-header flex items-center justify-between px-5 py-4 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {isGroup ? activeChat.recipientName : activeChat.recipientName}
          </h3>
          {isGroup && activeChat.memberCount && (
            <span className="text-sm text-gray-500 font-medium">
              ({activeChat.memberCount} members)
            </span>
          )}
        </div>

        {isGroup && (
          <button 
            className="text-gray-600 hover:text-gray-800 transition-colors"
            title="Group Info / Members"
          >
            {/* You can later add dropdown for members, info, leave group, etc. */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM6 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div 
        className="chat-messages flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50"
        onClick={() => setShowEmoji(false)}
      >
        {loadingMessages ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-xl font-medium">
              {isGroup ? "This group is quiet for now..." : "No messages yet"}
            </p>
            <p className="mt-2">
              {isGroup 
                ? "Be the first to say something!" 
                : "Start the conversation with a message."}
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageItem key={idx} msg={msg} isGroup={isGroup} />
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* File Preview */}
      {file && (
        <div className="p-3 bg-gray-100 border-t flex items-center justify-between">
          <div className="flex items-center gap-3">
            {file.type.startsWith('image/') ? (
              <img 
                src={URL.createObjectURL(file)} 
                alt="preview" 
                className="h-12 w-12 object-cover rounded" 
              />
            ) : file.type.startsWith('video/') ? (
              <FaVideo className="text-4xl text-gray-600" />
            ) : (
              <FaFileAlt className="text-4xl text-gray-600" />
            )}
            <div className="max-w-xs">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button 
            onClick={() => { setFile(null); fileInputRef.current.value = ""; }}
            className="p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50 transition"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="chat-input-area relative border-t bg-white">
        {showEmoji && (
          <div className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-xl">
            <EmojiPicker 
              onEmojiClick={(emoji) => setText(prev => prev + emoji.emoji)} 
              width={320} 
              height={400} 
              previewConfig={{ showPreview: false }}
            />
          </div>
        )}

        <form 
          className="flex items-center gap-3 p-4"
          onSubmit={handleSubmit}
        >
          <button
            type="button"
            className="text-yellow-500 hover:text-yellow-600 text-2xl transition-colors p-2 rounded-full hover:bg-yellow-50"
            onClick={() => setShowEmoji(prev => !prev)}
          >
            <FaSmile />
          </button>

          <button
            type="button"
            className="text-gray-600 hover:text-gray-800 text-xl transition-colors p-2 rounded-full hover:bg-gray-100"
            onClick={() => fileInputRef.current.click()}
          >
            <FaPaperclip />
          </button>

          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx,text/plain"
          />

          <input
            type="text"
            placeholder={isGroup ? "Type a message to the group..." : "Type a message..."}
            value={text}
            onChange={e => setText(e.target.value)}
            className="flex-1 px-5 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />

          <button 
            type="submit" 
            className={`p-3 rounded-full transition-colors ${
              text.trim() || file 
                ? 'bg-orange-500 text-white hover:bg-orange-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!text.trim() && !file}
          >
            <FaPaperPlane />
          </button>
        </form>
      </div>
    </div>
  );
};

// Updated MessageItem with group support
const MessageItem = ({ msg, isGroup }) => {
  const isMe = msg.isMyMessage;

  const renderAttachment = () => {
    if (!msg.attachment_url && !msg.attachment_file_id) return null;

    const url = msg.attachment_url || `http://localhost:5000/api/files/${msg.attachment_file_id}`;
    const type = msg.attachment_type || 'file';

    if (type.includes('image')) {
      return (
        <img 
          src={url} 
          alt="attachment" 
          className="max-w-full rounded-lg mb-3 cursor-pointer hover:opacity-90 transition"
          onClick={() => window.open(url, '_blank')}
        />
      );
    }

    if (type.includes('video')) {
      return <video src={url} controls className="max-w-full rounded-lg mb-3" />;
    }

    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noreferrer" 
        className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg mb-3 text-blue-600 hover:bg-gray-200 transition"
      >
        <FaFileAlt className="text-xl" /> 
        {msg.attachment_name || "Download File"}
      </a>
    );
  };

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-5`}>
      <div 
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isMe 
            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' 
            : 'bg-white shadow-sm border border-gray-200'
        }`}
      >
        {/* Show sender name in group chats (not for your own messages) */}
        {isGroup && !isMe && msg.sender_name && (
          <p className="text-xs font-semibold mb-1 text-gray-700">
            {msg.sender_name}
          </p>
        )}

        {renderAttachment()}

        {msg.text && (
          <p className="m-0 break-words leading-relaxed">
            {msg.text}
          </p>
        )}

        <div className={`text-xs mt-2 opacity-75 text-right ${
          isMe ? 'text-white' : 'text-gray-500'
        }`}>
          {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;