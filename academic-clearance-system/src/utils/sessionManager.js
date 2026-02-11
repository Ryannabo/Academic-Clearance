// src/utils/sessionManager.js - SESSION MANAGEMENT SYSTEM
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS_PER_USER = 3; // Maximum concurrent sessions

/**
 * Generate unique session ID
 */
const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get device information
 */
const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';

  // Detect browser
  if (userAgent.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (userAgent.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (userAgent.indexOf('Safari') > -1) browser = 'Safari';
  else if (userAgent.indexOf('Edge') > -1) browser = 'Edge';

  // Detect OS
  if (userAgent.indexOf('Windows') > -1) os = 'Windows';
  else if (userAgent.indexOf('Mac') > -1) os = 'MacOS';
  else if (userAgent.indexOf('Linux') > -1) os = 'Linux';
  else if (userAgent.indexOf('Android') > -1) os = 'Android';
  else if (userAgent.indexOf('iOS') > -1) os = 'iOS';

  return { browser, os, userAgent };
};

/**
 * Create new session
 */
export const createSession = async (userId, userEmail, userName) => {
  try {
    const sessionId = generateSessionId();
    const deviceInfo = getDeviceInfo();

    // Check existing sessions
    const existingSessions = await getUserSessions(userId);
    
    // If max sessions reached, delete oldest
    if (existingSessions.length >= MAX_SESSIONS_PER_USER) {
      const oldestSession = existingSessions.sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      )[0];
      await deleteSession(userId, oldestSession.sessionId);
    }

    const sessionData = {
      sessionId,
      userId,
      userEmail,
      userName,
      deviceInfo,
      ipAddress: 'N/A', // Can be enhanced with IP detection
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_TIMEOUT).toISOString(),
      active: true
    };

    await setDoc(doc(db, 'sessions', sessionId), sessionData);

    // Store session ID in localStorage
    localStorage.setItem('sessionId', sessionId);
    localStorage.setItem('sessionCreatedAt', sessionData.createdAt);

    console.log('✅ Session created:', sessionId);
    return { success: true, sessionId };
  } catch (error) {
    console.error('❌ Error creating session:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update session activity
 */
export const updateSessionActivity = async (sessionId) => {
  try {
    if (!sessionId) return { success: false };

    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      return { success: false, message: 'Session not found' };
    }

    await updateDoc(sessionRef, {
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_TIMEOUT).toISOString()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating session:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Validate session
 */
export const validateSession = async (sessionId) => {
  try {
    if (!sessionId) {
      return { valid: false, message: 'No session ID provided' };
    }

    const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));

    if (!sessionDoc.exists()) {
      return { valid: false, message: 'Session not found' };
    }

    const session = sessionDoc.data();
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);

    // Check if session expired
    if (now > expiresAt) {
      await deleteSession(session.userId, sessionId);
      return { valid: false, message: 'Session expired' };
    }

    // Check if session is active
    if (!session.active) {
      return { valid: false, message: 'Session is inactive' };
    }

    // Update last activity
    await updateSessionActivity(sessionId);

    return { valid: true, session };
  } catch (error) {
    console.error('Error validating session:', error);
    return { valid: false, error: error.message };
  }
};

/**
 * Get all sessions for a user
 */
export const getUserSessions = async (userId) => {
  try {
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', userId),
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return [];
  }
};

/**
 * Delete session (logout)
 */
export const deleteSession = async (userId, sessionId) => {
  try {
    if (!sessionId) {
      sessionId = localStorage.getItem('sessionId');
    }

    if (sessionId) {
      await deleteDoc(doc(db, 'sessions', sessionId));
      localStorage.removeItem('sessionId');
      localStorage.removeItem('sessionCreatedAt');
      console.log('✅ Session deleted:', sessionId);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting session:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete all sessions for a user (logout all devices)
 */
export const deleteAllUserSessions = async (userId) => {
  try {
    const sessions = await getUserSessions(userId);
    
    const deletePromises = sessions.map(session => 
      deleteDoc(doc(db, 'sessions', session.sessionId))
    );

    await Promise.all(deletePromises);
    localStorage.removeItem('sessionId');
    localStorage.removeItem('sessionCreatedAt');

    console.log(`✅ Deleted ${sessions.length} sessions for user:`, userId);
    return { success: true, count: sessions.length };
  } catch (error) {
    console.error('Error deleting all sessions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Clean up expired sessions (run periodically)
 */
export const cleanupExpiredSessions = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'sessions'));
    const now = new Date();
    let deletedCount = 0;

    const deletePromises = snapshot.docs
      .filter(doc => {
        const expiresAt = new Date(doc.data().expiresAt);
        return now > expiresAt;
      })
      .map(doc => {
        deletedCount++;
        return deleteDoc(doc.ref);
      });

    await Promise.all(deletePromises);
    console.log(`🧹 Cleaned up ${deletedCount} expired sessions`);
    return { success: true, count: deletedCount };
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to session changes (for real-time updates)
 */
export const subscribeToSession = (sessionId, callback) => {
  if (!sessionId) return () => {};

  const sessionRef = doc(db, 'sessions', sessionId);
  
  return onSnapshot(sessionRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ exists: true, data: snapshot.data() });
    } else {
      callback({ exists: false });
    }
  });
};

/**
 * Get session duration
 */
export const getSessionDuration = (createdAt) => {
  const start = new Date(createdAt);
  const now = new Date();
  const duration = now - start;

  const minutes = Math.floor(duration / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
};

/**
 * Format last activity time
 */
export const formatLastActivity = (lastActivity) => {
  const last = new Date(lastActivity);
  const now = new Date();
  const diff = now - last;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};