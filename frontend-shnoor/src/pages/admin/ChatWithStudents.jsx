// src/pages/admin/ChatWithStudents.jsx
import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, X, Loader2 } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import ChatList from '../../components/Chat/ChatList';
import ChatWindow from '../../components/Chat/ChatWindow';
import api from '../../api/axios';
import { getAuth } from 'firebase/auth';

const ChatWithStudents = () => {
  const { socket, dbUser, unreadCounts, markChatRead, handleSetActiveChat } = useSocket();

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [error, setError] = useState(null);

  // Group modal
  const [addMode, setAddMode] = useState('college'); // 'college' or 'manual'
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [loadingColleges, setLoadingColleges] = useState(false);
  const fetchExecuted = useRef(false);
  useEffect(() => {
  if (fetchExecuted.current) return;
  fetchExecuted.current = true;

  // Inside fetchData (replace the existing chats fetch block)
const fetchData = async () => {
  try {
    setLoadingChats(true);
    setError(null);

    // 1-on-1 chats (existing)
    const chatsRes = await api.get('/api/chats');
    const oneOnOneChats = chatsRes.data.map(c => ({
      id: c.chat_id,
      type: '1on1',
      recipientName: c.recipient_name,
      recipientId: c.recipient_id,
      lastMessage: c.last_message || 'No messages yet',
      unread: c.unread_count || 0,
    }));

    // Available students for new 1-on-1 (existing)
    const studentsRes = await api.get('/api/chats/available-students');
    const allStudents = studentsRes.data;

    const mergedOneOnOne = [...oneOnOneChats];
    allStudents.forEach(s => {
      if (!oneOnOneChats.some(c => c.recipientId === s.user_id)) {
        mergedOneOnOne.push({
          id: `new_${s.user_id}`,
          type: '1on1',
          recipientName: s.full_name || s.email?.split('@')[0],
          recipientId: s.user_id,
          lastMessage: 'Start a conversation',
          unread: 0,
        });
      }
    });

    // ADD THIS: Fetch all groups for admin
    const groupsRes = await api.get('/api/groups');
    const adminGroups = groupsRes.data.map(g => ({
      id: g.group_id,
      type: 'group',
      recipientName: g.name,
      lastMessage: 'Group chat', // can improve later with real last msg
      unread: 0,
      memberCount: g.member_count || 0,
    }));

    // Combine both
    const allChats = [...mergedOneOnOne, ...adminGroups];

    setChats(allChats);
  } catch (err) {
    console.error('Failed to load admin data:', err);
    setError('Failed to load chats & groups');
  } finally {
    setLoadingChats(false);
  }
};

  fetchData();
}, [unreadCounts]);

  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (msg) => {
      if (msg.chat_id === activeChat?.id) {
        setMessages(prev => [...prev, {
          ...msg,
          isMyMessage: msg.sender_id === dbUser?.id
        }]);
      }
    };

    socket.on('new_message', onNewMessage);
    return () => socket.off('new_message', onNewMessage);
  }, [socket, activeChat, dbUser]);

  const handleSelectChat = async (chat) => {
  setActiveChat(chat);
  handleSetActiveChat(chat.id);
  markChatRead(chat.id);

  setLoadingMessages(true);
  setMessages([]);

  if (chat.id.startsWith('new_')) {
    setMessages([]);
    setLoadingMessages(false);
    return;
  }

  try {
    let res;

    if (chat.type === 'group') {
      // JOIN GROUP ROOM (this was missing for admin!)
      if (socket) {
        socket.emit('join_group', chat.id);
        console.log(`[Admin] Joined group room: ${chat.id}`);
      }

      res = await api.get(`/api/groups/${chat.id}/messages`);
    } else {
      res = await api.get(`/api/chats/messages/${chat.id}`);
    }

    setMessages(
      res.data.map(m => ({
        ...m,
        isMyMessage: m.sender_id === dbUser?.id,
        sender_name: m.sender_name || 'Unknown',
      }))
    );
  } catch (err) {
    console.error('[Messages] Failed to load:', err);
    setError('Could not load messages');
  } finally {
    setLoadingMessages(false);
  }
};
useEffect(() => {
  if (!socket) return;

  const handleGroupMessage = (msg) => {
    // Only append if this is the currently open group
    if (msg.group_id === activeChat?.id) {
      setMessages(prev => [...prev, {
        ...msg,
        isMyMessage: msg.sender_id === dbUser?.id,
        sender_name: msg.sender_name || 'Unknown',
      }]);
    }

    // Optional: show notification/toast for other groups
    // e.g. if (msg.group_id !== activeChat?.id) { show toast }
  };

  socket.on('group_message', handleGroupMessage);

  return () => {
    socket.off('group_message', handleGroupMessage);
  };
}, [socket, activeChat, dbUser]);

  const handleSendMessage = async (text, file) => {
  if (!socket || !activeChat || (!text?.trim() && !file)) return;

  const isGroupChat = activeChat.type === 'group';

  // ── 1. Handle new 1-on-1 chat creation (only for private chats) ─────────────
  let chatId = activeChat.id;

  if (!isGroupChat && chatId.startsWith('new_')) {
    try {
      const createRes = await api.post('/api/chats', {
        recipientId: activeChat.recipientId,
      });
      chatId = createRes.data.chat_id;
      setActiveChat(prev => ({ ...prev, id: chatId, type: '1on1' }));
    } catch (err) {
      console.error('Failed to create 1-on-1 chat:', err);
      alert('Failed to start conversation');
      return;
    }
  }

  // ── 2. Prepare payload according to chat type ───────────────────────────────
  const payload = {
    // Common fields
    text: text?.trim() || null,
    senderId: dbUser?.id,
    senderUid: dbUser?.firebase_uid || dbUser?.uid,
    senderName: dbUser?.full_name || dbUser?.name || 'You',

    // Type-specific fields
    ...(isGroupChat
      ? { groupId: chatId }                 // group chat → send groupId
      : { chatId, recipientId: activeChat.recipientId }  // 1-on-1 → chatId + recipient
    ),

    // Attachments (add when you implement file upload)
    // attachment_file_id: file?.id || null,
    // attachment_type: file?.type || null,
    // attachment_name: file?.name || null,
  };

  // ── 3. Optimistic UI update ─────────────────────────────────────────────────
  const optimisticMessage = {
    text,
    created_at: new Date().toISOString(),
    sender_id: dbUser?.id,
    sender_name: dbUser?.full_name || 'You',
    isMyMessage: true,
    // Optional: group-specific fields for rendering
    ...(isGroupChat && { group_id: chatId }),
  };

  setMessages(prev => [...prev, optimisticMessage]);

  // ── 4. Emit the correct event with correct payload ───────────────────────────
  try {
    socket.emit('send_message', payload);
  } catch (err) {
    console.error('Socket emit failed:', err);
    // Optional: rollback optimistic message
    setMessages(prev => prev.filter(m => m.created_at !== optimisticMessage.created_at));
    alert('Failed to send message');
  }
};

  const handleCreateGroup = async () => {
  if (!groupName.trim()) return alert('Group name is required');

  setCreatingGroup(true);

  try {
    let payload = {
      name: groupName.trim(),
      description: groupDescription.trim() || null,
    };

    let endpoint = '/api/groups'; // default for manual

    if (addMode === 'college') {
      if (!selectedCollege) return alert('Please select a college');
      payload.college_id = selectedCollege;
      endpoint = '/api/groups/by-college';
    } else {
      // Manual mode
      if (selectedMembers.length === 0) return alert('Select at least one student');
      payload.studentIds = selectedMembers;
    }

    const res = await api.post(endpoint, payload);

    alert(`Group created successfully!\nAdded ${res.data.member_count || selectedMembers.length || '?'} students.`);

    setShowGroupModal(false);
    setGroupName('');
    setGroupDescription('');
    setSelectedCollege('');
    setSelectedMembers([]);
    setAddMode('college'); // reset to default
  } catch (err) {
    console.error('Group creation failed:', err);
    alert('Failed to create group: ' + (err.response?.data?.message || err.message));
  } finally {
    setCreatingGroup(false);
  }
};
// Fetch colleges when modal opens
useEffect(() => {
  if (showGroupModal) {
    setLoadingColleges(true);
    api.get('/api/groups/colleges')
      .then(res => setColleges(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoadingColleges(false));
  }
}, [showGroupModal]);

// Fetch colleges only when needed
useEffect(() => {
  if (showGroupModal && addMode === 'college') {
    setLoadingColleges(true);
    api.get('/api/groups/colleges')
      .then(res => setColleges(res.data))
      .catch(err => console.error('Failed to load colleges:', err))
      .finally(() => setLoadingColleges(false));
  }
}, [showGroupModal, addMode]);

 return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-80 md:w-96 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b bg-white sticky top-0 z-10 shadow-sm">
          <button
            onClick={() => setShowGroupModal(true)}
            disabled={loadingChats || creatingGroup}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-3 rounded-lg font-medium shadow-sm transition-all transform hover:scale-[1.02] active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusCircle size={20} />
            Create New Group
          </button>
        </div>

        {loadingChats ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : error ? (
          <div className="flex-1 p-6 text-center text-red-600">{error}</div>
        ) : (
          <ChatList
            chats={chats}
            activeChat={activeChat}
            onSelectChat={handleSelectChat}
            unreadCounts={unreadCounts}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col bg-gray-50">
        <ChatWindow
          activeChat={activeChat}
          messages={messages}
          onSendMessage={handleSendMessage}
          loadingMessages={loadingMessages}
        />
      </div>

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-5 flex items-center justify-between z-10">
              <h3 className="text-xl font-bold text-gray-900">Create New Student Group</h3>
              <button onClick={() => setShowGroupModal(false)}>
                <X size={24} className="text-gray-600 hover:text-gray-800" />
              </button>
            </div>

  
<div className="p-6 space-y-6">
  {/* Group Name */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Group Name <span className="text-red-500">*</span>
    </label>
    <input
      type="text"
      value={groupName}
      onChange={e => setGroupName(e.target.value)}
      placeholder="e.g. B.Tech CSE 2025 Batch"
      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
      required
    />
  </div>

  {/* Description */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Description (optional)
    </label>
    <textarea
      value={groupDescription}
      onChange={e => setGroupDescription(e.target.value)}
      placeholder="Purpose, schedule, rules..."
      rows={4}
      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none"
    />
  </div>

  {/* New: Mode Toggle */}
  <div className="flex items-center gap-4">
    <label className="text-sm font-medium text-gray-700">
      Add students by:
    </label>
    <div className="flex gap-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="addMode"
          value="college"
          checked={addMode === 'college'}
          onChange={() => setAddMode('college')}
          className="h-4 w-4 text-orange-500 focus:ring-orange-500"
        />
        <span>College (auto-add all)</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="addMode"
          value="manual"
          checked={addMode === 'manual'}
          onChange={() => setAddMode('manual')}
          className="h-4 w-4 text-orange-500 focus:ring-orange-500"
        />
        <span>Manual Selection</span>
      </label>
    </div>
  </div>

  {/* Conditional content based on mode */}
  {addMode === 'college' ? (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select College <span className="text-red-500">*</span>
      </label>

      {loadingColleges ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading colleges...
        </div>
      ) : colleges.length === 0 ? (
        <p className="text-red-600">No colleges found in the system</p>
      ) : (
        <select
          value={selectedCollege}
          onChange={e => setSelectedCollege(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          required
        >
          <option value="">-- Choose a college --</option>
          {colleges.map(c => (
            <option key={c.college_id} value={c.college_id}>
              {c.name} ({c.student_count || 0} students)
            </option>
          ))}
        </select>
      )}

      <p className="mt-2 text-sm text-gray-500">
        All students from the selected college will be automatically added.
      </p>
    </div>
  ) : (
    // Manual mode – old checkbox list (keep your existing code here)
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Students <span className="text-red-500">*</span>
      </label>
      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
        {chats
          .filter(chat => chat.type === '1on1')
          .map(student => (
            <label key={student.recipientId} className="flex items-center gap-3 p-3 hover:bg-white rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMembers.includes(student.recipientId)}
                onChange={e => {
                  if (e.target.checked) {
                    setSelectedMembers([...selectedMembers, student.recipientId]);
                  } else {
                    setSelectedMembers(selectedMembers.filter(id => id !== student.recipientId));
                  }
                }}
                className="h-5 w-5 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
              />
              <span className="text-gray-900 font-medium">{student.recipientName}</span>
            </label>
          ))}
      </div>
      <p className="mt-2 text-sm text-gray-500">
        {selectedMembers.length} student{selectedMembers.length !== 1 ? 's' : ''} selected
      </p>
    </div>
  )}
</div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-5 flex justify-end gap-4">
              <button
                onClick={() => setShowGroupModal(false)}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                disabled={creatingGroup}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creatingGroup || !groupName.trim() || !selectedCollege || loadingColleges}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creatingGroup && <Loader2 className="h-5 w-5 animate-spin" />}
                {creatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWithStudents;