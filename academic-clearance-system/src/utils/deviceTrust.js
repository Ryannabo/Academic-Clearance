// src/utils/deviceTrust.js
import { db } from '../firebase/config';
import { doc, setDoc, getDoc, deleteDoc, collection } from 'firebase/firestore';

// Generate or retrieve persistent device ID
export const getDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

// Check if this device is trusted for the user (and not expired)
export const isDeviceTrusted = async (userId) => {
  try {
    const deviceId = getDeviceId();
    const trustRef = doc(db, 'users', userId, 'trusted_devices', deviceId);
    const trustDoc = await getDoc(trustRef);
    if (!trustDoc.exists()) return false;

    const data = trustDoc.data();
    const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);
    if (expiresAt < new Date()) {
      // Auto-cleanup expired
      await deleteDoc(trustRef);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error checking trusted device:', error);
    return false;
  }
};

// Trust this device (default 30 days)
export const trustDevice = async (userId, deviceName = null) => {
  try {
    const deviceId = getDeviceId();
    const trustRef = doc(db, 'users', userId, 'trusted_devices', deviceId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // +30 days

    await setDoc(trustRef, {
      deviceId,
      deviceName: deviceName || navigator.userAgent || 'Unknown device',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error trusting device:', error);
    return { success: false, error: error.message };
  }
};

// Remove trust from this device (logout from this device)
export const untrustDevice = async (userId) => {
  try {
    const deviceId = getDeviceId();
    const trustRef = doc(db, 'users', userId, 'trusted_devices', deviceId);
    await deleteDoc(trustRef);
    return { success: true };
  } catch (error) {
    console.error('Error untrusting device:', error);
    return { success: false, error: error.message };
  }
};