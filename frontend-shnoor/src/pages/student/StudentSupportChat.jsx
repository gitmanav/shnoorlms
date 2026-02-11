// In fetchData() of StudentChat.jsx
// Get existing chats (already includes admin if exists)
// Get available instructors (already there)
// Add available admins
const adminsRes = await api.get('/api/chats/available-admins');
const allAdmins = adminsRes.data;

// Merge admins the same way as instructors
allAdmins.forEach(admin => {
    const alreadyExists = existingChats.some(c => c.recipientId === admin.user_id);
    if (!alreadyExists) {
        mergedChats.push({
            id: `new_${admin.user_id}`,
            recipientName: admin.full_name || "Admin Support",
            recipientId: admin.user_id,
            lastMessage: 'Ask support',
            unread: 0,
            exists: false
        });
    }
});