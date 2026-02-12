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
  onSnapshot,
  writeBatch // 🔥 IMPORT THIS – WAS MISSING
} from 'firebase/firestore';
import { db } from '../firebase/config';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS_PER_USER = 3;
const ACTIVITY_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes – don't write more often

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
 * Update session activity – THROTTLED: only updates if last update > 5 min ago
 */
export const updateSessionActivity = async (sessionId) => {
  try {
    if (!sessionId) return { success: false };

    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      return { success: false, message: 'Session not found' };
    }

    const sessionData = sessionDoc.data();
    const lastActivity = new Date(sessionData.lastActivity);
    const now = new Date();

    // ⏳ Only write if last activity was more than 5 minutes ago
    if (now - lastActivity < ACTIVITY_UPDATE_INTERVAL) {
      return { success: true, skipped: true };
    }

    await updateDoc(sessionRef, {
      lastActivity: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TIMEOUT).toISOString()
    });

    return { success: true, skipped: false };
  } catch (error) {
    // Don't crash on quota errors – just log and return
    if (error.code === 'resource-exhausted') {
      console.warn('⚠️ Quota exceeded – session update skipped');
      return { success: false, error: 'quota_exceeded' };
    }
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
    //await updateSessionActivity(sessionId);

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
 * Clean up expired sessions – THROTTLED for Spark plan
 * Deletes max 500 sessions per minute to stay under quota.
 */
export const cleanupExpiredSessions = async () => {
  try {
    const sessionsRef = collection(db, 'sessions');
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const q = query(
      sessionsRef,
      where('expiresAt', '<', oneHourAgo.toISOString()),
      limit(500)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log('🧹 No expired sessions to clean');
      return;
    }

    console.log(`🧹 Cleaning ${snapshot.size} expired sessions (throttled)`);
    let deleted = 0;
    const BATCH_SIZE = 100;
    const DELAY_MS = 2000;

    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchDocs = snapshot.docs.slice(i, i + BATCH_SIZE);
      batchDocs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deleted += batchDocs.length;
      console.log(`  ✅ Deleted ${deleted} / ${snapshot.size} sessions`);
      if (i + BATCH_SIZE < snapshot.docs.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    console.log(`🧹 Cleanup complete: deleted ${deleted} sessions`);
  } catch (error) {
    if (error.code === 'resource-exhausted') {
      console.warn('⚠️ Quota exceeded during session cleanup – will retry later');
    } else {
      console.error('Error cleaning up sessions:', error);
    }
  }
};

/**
 * Subscribe to session changes (for real-time updates)
 */
export const subscribeToSession = (sessionId, callback) => {
  if (!sessionId) return () => { };
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