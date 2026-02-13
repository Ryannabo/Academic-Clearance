// src/components/NotificationPanel.jsx (RESPONSIVE – LOGIC UNCHANGED)
import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, XCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  limit,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function NotificationPanel() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --------------------- ALL LOGIC REMAINS EXACTLY THE SAME ---------------------
  useEffect(() => {
    if (!user || !user.uid) {
      console.log('⚠️ No user logged in, skipping notification subscription');
      setLoading(false);
      return;
    }

    console.log('🔔 NotificationPanel: Subscribing to notifications for user:', user.uid);
    setLoading(true);
    setError(null);

    try {
      const notifQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        limit(50)
      );

      console.log('📡 Setting up real-time listener...');

      const unsubscribe = onSnapshot(
        notifQuery,
        (snapshot) => {
          console.log(`📬 Received ${snapshot.size} notification(s) from Firestore`);

          const notifs = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data
            };
          });

          notifs.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
          });

          setNotifications(notifs);
          const unread = notifs.filter(n => !n.read).length;
          setUnreadCount(unread);
          console.log(`✅ Loaded ${notifs.length} notifications, ${unread} unread`);
          setLoading(false);
        },
        (err) => {
          console.error('❌ Error in notification subscription:', err);
          console.error('Error code:', err.code);
          console.error('Error message:', err.message);
          setError(err.message);
          setLoading(false);

          if (err.code === 'permission-denied') {
            console.error('🔒 PERMISSION DENIED - Check Firestore security rules!');
          }
        }
      );

      return () => {
        console.log('🔌 Unsubscribing from notifications');
        unsubscribe();
      };

    } catch (err) {
      console.error('❌ Error setting up notification subscription:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [user]);

  const handleOpenPanel = async () => {
    setShowPanel(true);

    if (unreadCount > 0) {
      console.log(`📝 Auto-marking ${unreadCount} notifications as read...`);

      try {
        const unreadNotifs = notifications.filter(n => !n.read);
        const batch = writeBatch(db);

        unreadNotifs.forEach(notif => {
          const notifRef = doc(db, 'notifications', notif.id);
          batch.update(notifRef, {
            read: true,
            readAt: new Date().toISOString()
          });
        });

        await batch.commit();
        console.log('✅ All notifications marked as read');
        setUnreadCount(0);
      } catch (error) {
        console.error('❌ Error auto-marking as read:', error);
      }
    }
  };

  const manualRefresh = async () => {
    if (!user || !user.uid) return;

    console.log('🔄 Manual refresh triggered...');
    setLoading(true);

    try {
      const notifQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        limit(50)
      );

      const snapshot = await getDocs(notifQuery);
      console.log(`📬 Manual fetch: Found ${snapshot.size} notifications`);

      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      notifs.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
      setLoading(false);
    } catch (err) {
      console.error('❌ Manual refresh error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const markAsRead = async (notifId) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        read: true,
        readAt: new Date().toISOString()
      });
      console.log('✅ Marked notification as read:', notifId);
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      console.log(`📝 Marking ${unreadNotifs.length} notifications as read...`);

      const batch = writeBatch(db);

      unreadNotifs.forEach(n => {
        const notifRef = doc(db, 'notifications', n.id);
        batch.update(notifRef, {
          read: true,
          readAt: new Date().toISOString()
        });
      });

      await batch.commit();
      console.log('✅ All notifications marked as read');
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notifId) => {
    try {
      await deleteDoc(doc(db, 'notifications', notifId));
      console.log('✅ Deleted notification:', notifId);
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'approved': return <CheckCircle className="text-green-600" size={20} />;
      case 'rejected': return <XCircle className="text-red-600" size={20} />;
      case 'pending': return <Clock className="text-amber-600" size={20} />;
      case 'info': return <AlertCircle className="text-blue-600" size={20} />;
      default: return <Bell className="text-gray-600" size={20} />;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';

    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return date.toLocaleDateString();
    } catch (err) {
      console.error('Error formatting time:', err);
      return 'Unknown';
    }
  };

  // --------------------- FULLY RESPONSIVE RENDER (UI ONLY) ---------------------
  return (
    <div className="relative">
      {/* Bell Icon with Badge – compact on mobile */}
      <button
        onClick={handleOpenPanel}
        className="relative p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        title={loading ? 'Loading notifications...' : `${unreadCount} unread notification(s)`}
      >
        <Bell className={`${loading ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`} size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel – fully responsive */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPanel(false)}
          />

          {/* 
            ✅ MOBILE: full width with margin (inset-x-2), positioned below bell
            ✅ DESKTOP: fixed width, right-aligned 
          */}
          <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-14 sm:top-12 w-auto sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-[calc(100vh-100px)] sm:max-h-[600px] flex flex-col">

            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">
                  Notifications
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {loading ? 'Loading...' :
                    error ? `Error: ${error}` :
                      unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium whitespace-nowrap"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={manualRefresh}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  title="Refresh notifications"
                >
                  🔄
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                <p className="text-xs sm:text-sm text-red-800 dark:text-red-400 break-words">
                  ⚠️ {error}
                </p>
                <button
                  onClick={manualRefresh}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline mt-2"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-6 sm:p-8 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto mb-2"></div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Loading notifications...
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 sm:p-8 text-center">
                  <Bell className="mx-auto mb-4 text-gray-300 dark:text-gray-600" size={32} />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
                  <button
                    onClick={manualRefresh}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!notif.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs sm:text-sm ${!notif.read ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-800 dark:text-gray-200'
                            } break-words`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {formatTime(notif.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                          className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 p-1"
                          title="Delete notification"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 sm:p-3 border-t border-gray-200 dark:border-gray-700 text-center bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={() => setShowPanel(false)}
                  className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}