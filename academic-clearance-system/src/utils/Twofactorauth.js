// src/utils/twoFactorAuth.js - 2FA SYSTEM (COMPLETELY FIXED)
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import emailjs from '@emailjs/browser';

/**
 * Get EmailJS configuration from environment
 * This function safely accesses environment variables
 */
const getEmailConfig = () => {
  // For Create React App (most common)
  if (typeof window !== 'undefined' && window._env_) {
    return {
      serviceId: window._env_.REACT_APP_EMAILJS_SERVICE_ID,
      templateId: window._env_.REACT_APP_EMAILJS_2FA_TEMPLATE_ID,
      publicKey: window._env_.REACT_APP_EMAILJS_PUBLIC_KEY
    };
  }

  // Fallback: Try to access via globalThis (safer than process.env)
  try {
    // Access bundled environment variables
    const serviceId = globalThis.REACT_APP_EMAILJS_SERVICE_ID;
    const templateId = globalThis.REACT_APP_EMAILJS_2FA_TEMPLATE_ID;
    const publicKey = globalThis.REACT_APP_EMAILJS_PUBLIC_KEY;

    if (serviceId && templateId && publicKey) {
      return { serviceId, templateId, publicKey };
    }
  } catch (e) {
    // Continue to next method
  }

  // Last resort: Return placeholder values
  // YOU MUST REPLACE THESE WITH YOUR ACTUAL VALUES
  return {
    serviceId: 'YOUR_SERVICE_ID',      // ← Replace with your actual service ID
    templateId: 'YOUR_2FA_TEMPLATE_ID', // ← Replace with your actual 2FA template ID
    publicKey: 'YOUR_PUBLIC_KEY'        // ← Replace with your actual public key
  };
};

/**
 * Generate a 6-digit OTP code
 */
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP via email (integrates with EmailJS)
 */
export const sendOTPEmail = async (email, otp, userName) => {
  try {
    // HARDCODED CONFIG - Replace with your actual values
    const serviceId = 'service_wqfpk9k';        // ← Paste your service ID
    const templateId = 'template_e0jozr4';      // ← Paste your template ID
    const publicKey = 'vBQxZ_dv3-mZzSw8M';      // ← Paste your public key

    // Validate configuration
    if (!serviceId || !templateId || !publicKey) {
      throw new Error('EmailJS not configured');
    }

    const templateParams = {
      to_email: email,
      to_name: userName,
      otp_code: otp,
      expiry_minutes: '10',
      app_name: 'Academic Clearance System'
    };

    console.log('📧 Sending 2FA OTP to:', email);
    console.log('Using Service ID:', serviceId);

    const response = await emailjs.send(
      serviceId,
      templateId,
      templateParams,
      publicKey
    );

    console.log('✅ 2FA OTP sent successfully:', response);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send 2FA OTP:', error);
    
    // Provide helpful error messages
    if (error.message.includes('not configured')) {
      return { 
        success: false, 
        error: 'Email service not configured. Please contact administrator.' 
      };
    }
    
    if (error.text) {
      return { success: false, error: error.text };
    }
    
    return { success: false, error: error.message || 'Failed to send email' };
  }
};

/**
 * Store OTP in Firestore with expiry
 */
export const storeOTP = async (userId, email, otp) => {
  try {
    const otpRef = doc(db, 'otp_codes', userId);
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await setDoc(otpRef, {
      userId,
      email,
      otp,
      createdAt: new Date().toISOString(),
      expiresAt: expiryTime.toISOString(),
      verified: false,
      attempts: 0,
      maxAttempts: 5
    });

    return { success: true };
  } catch (error) {
    console.error('Error storing OTP:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Verify OTP code
 */
export const verifyOTP = async (userId, enteredOTP) => {
  try {
    const otpRef = doc(db, 'otp_codes', userId);
    const otpDoc = await getDoc(otpRef);

    if (!otpDoc.exists()) {
      return { success: false, message: 'No OTP found. Please request a new one.' };
    }

    const otpData = otpDoc.data();
    const now = new Date();
    const expiryTime = new Date(otpData.expiresAt);

    // Check expiry
    if (now > expiryTime) {
      await deleteDoc(otpRef);
      return { success: false, message: 'OTP has expired. Please request a new one.' };
    }

    // Check attempts
    if (otpData.attempts >= otpData.maxAttempts) {
      await deleteDoc(otpRef);
      return { success: false, message: 'Maximum attempts exceeded. Please request a new OTP.' };
    }

    // Verify OTP
    if (otpData.otp === enteredOTP) {
      await updateDoc(otpRef, {
        verified: true,
        verifiedAt: new Date().toISOString()
      });

      // Delete OTP after successful verification
      setTimeout(() => deleteDoc(otpRef), 5000);

      return { success: true, message: 'OTP verified successfully!' };
    } else {
      // Increment attempts
      await updateDoc(otpRef, {
        attempts: otpData.attempts + 1
      });

      const remainingAttempts = otpData.maxAttempts - (otpData.attempts + 1);
      return { 
        success: false, 
        message: `Invalid OTP. ${remainingAttempts} attempts remaining.` 
      };
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { success: false, message: 'Verification failed. Please try again.' };
  }
};

/**
 * Check if 2FA is enabled for user
 */
export const is2FAEnabled = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data().twoFactorEnabled || false;
    }
    return false;
  } catch (error) {
    console.error('Error checking 2FA status:', error);
    return false;
  }
};

/**
 * Enable 2FA for user
 */
export const enable2FA = async (userId) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      twoFactorEnabled: true,
      twoFactorEnabledAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Disable 2FA for user
 */
export const disable2FA = async (userId) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      twoFactorEnabled: false,
      twoFactorDisabledAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Clean up expired OTPs (run periodically)
 */
export const cleanupExpiredOTPs = async () => {
  try {
    const otpCollection = collection(db, 'otp_codes');
    const snapshot = await getDocs(otpCollection);
    const now = new Date();
    let deletedCount = 0;

    const deletePromises = snapshot.docs
      .filter(doc => {
        const expiryTime = new Date(doc.data().expiresAt);
        return now > expiryTime;
      })
      .map(doc => {
        deletedCount++;
        return deleteDoc(doc.ref);
      });

    await Promise.all(deletePromises);
    console.log(`🧹 Cleaned up ${deletedCount} expired OTPs`);
  } catch (error) {
    console.error('Error cleaning up OTPs:', error);
  }
};