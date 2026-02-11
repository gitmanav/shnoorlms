import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { MessageSquare, Users, Calendar, Loader2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';
const MyGroups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
  const fetchMyGroups = async () => {
  try {
    setLoading(true);
    setError(null);

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setError('Please log in to view your groups');
      return;
    }

    // Force refresh token
    const freshToken = await user.getIdToken(true);
    console.log('[MyGroups] Fresh token generated');

    const res = await api.get('/api/groups/my-groups', {
      headers: {
        Authorization: `Bearer ${freshToken}`
      }
    });

    console.log('[MyGroups] Success - status:', res.status);
    console.log('[MyGroups] Groups data:', res.data);

    setGroups(res.data || []);
  } catch (err) {
    console.error('Failed to load groups:', err);

    let msg = 'Could not load your groups.';

    if (err.response?.status === 401) {
      msg = 'Your session has expired. Please log out and log in again.';
      // Optional: auto-logout or redirect
      // auth.signOut().then(() => navigate('/login'));
    } else if (err.response?.status === 403) {
      msg = 'You do not have permission to view groups.';
    } else if (err.message.includes('network')) {
      msg = 'Network error – please check your connection.';
    }

    setError(msg);
  } finally {
    setLoading(false);
  }
};

    fetchMyGroups();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 px-4 text-red-600">
        {error}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Users className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          No Groups Yet
        </h2>
        <p className="text-gray-600 max-w-md mx-auto">
          Your admin hasn't added you to any group yet. Check back later or contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Groups</h1>
        <span className="text-sm text-gray-500">
          {groups.length} {groups.length === 1 ? 'group' : 'groups'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <div
            key={group.group_id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {group.name}
                  </h3>
                  {group.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                      {group.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Calendar size={14} />
                  {new Date(group.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
                <Users size={16} />
                <span>{group.member_count || '...' } members</span>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
              <Link
                to={`/student/groups/${group.group_id}`}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                <MessageSquare size={16} />
                Open Chat
              </Link>

              {group.unread_count > 0 && (
                <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {group.unread_count} new
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyGroups;