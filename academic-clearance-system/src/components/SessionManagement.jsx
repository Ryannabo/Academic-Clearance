// src/components/SessionManagement.jsx - ACTIVE SESSIONS VIEWER
import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, AlertCircle, Trash2, LogOut, Clock, MapPin } from 'lucide-react';
import { 
  getUserSessions, 
  deleteSession, 
  deleteAllUserSessions,
  getSessionDuration,
  formatLastActivity 
} from '../utils/sessionManager';

export default function SessionManagement({ userId, currentSessionId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadSessions();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadSessions = async () => {
    try {
      const userSessions = await getUserSessions(userId);
      setSessions(userSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to end this session?')) return;

    setDeleting(sessionId);
    try {
      await deleteSession(userId, sessionId);
      await loadSessions();
      
      if (sessionId === currentSessionId) {
        alert('Current session ended. You will be logged out.');
        window.location.reload();
      }
    } catch (error) {
      alert('Failed to delete session: ' + error.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!confirm('⚠️ This will log you out from ALL devices including this one. Continue?')) return;

    setLoading(true);
    try {
      await deleteAllUserSessions(userId);
      alert('All sessions ended. You will be logged out.');
      window.location.reload();
    } catch (error) {
      alert('Failed to logout all devices: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (deviceInfo) => {
    if (!deviceInfo) return <Monitor className="text-gray-500 dark:text-gray-400" size={24} />;
    
    const os = deviceInfo.os?.toLowerCase() || '';
    if (os.includes('android') || os.includes('ios')) {
      return <Smartphone className="text-gray-500 dark:text-gray-400" size={24} />;
    }
    return <Monitor className="text-gray-500 dark:text-gray-400" size={24} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Active Sessions</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage devices where you're currently logged in ({sessions.length})
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={handleLogoutAllDevices}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-sm"
          >
            <LogOut size={16} />
            Logout All Devices
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <AlertCircle className="mx-auto mb-3 text-gray-400 dark:text-gray-500" size={48} />
          <p className="text-gray-600 dark:text-gray-400">No active sessions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => {
            const isCurrentSession = session.sessionId === currentSessionId;
            const duration = getSessionDuration(session.createdAt);
            const lastActivity = formatLastActivity(session.lastActivity);

            return (
              <div
                key={session.sessionId}
                className={`border rounded-lg p-4 transition-all ${
                  isCurrentSession
                    ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getDeviceIcon(session.deviceInfo)}
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                          {session.deviceInfo?.browser || 'Unknown Browser'} on {session.deviceInfo?.os || 'Unknown OS'}
                        </h4>
                        {isCurrentSession && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs rounded-full font-medium">
                            Current Session
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Clock size={14} />
                          <span>Active for {duration} • Last activity: {lastActivity}</span>
                        </div>
                        {session.ipAddress && session.ipAddress !== 'N/A' && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} />
                            <span>{session.ipAddress}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Started: {new Date(session.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteSession(session.sessionId)}
                    disabled={deleting === session.sessionId}
                    className="ml-4 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                    title={isCurrentSession ? 'End current session' : 'End session'}
                  >
                    {deleting === session.sessionId ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600 dark:border-red-400"></div>
                    ) : (
                      <Trash2 size={20} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-blue-800 dark:text-blue-400">
            <p className="font-medium mb-1">Session Security</p>
            <ul className="space-y-1 text-xs">
              <li>• Sessions automatically expire after 30 minutes of inactivity</li>
              <li>• Maximum of 3 concurrent sessions allowed per account</li>
              <li>• End sessions from unrecognized devices immediately</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}