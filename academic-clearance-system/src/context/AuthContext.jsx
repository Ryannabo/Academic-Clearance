// src/context/AuthContext.jsx – COMPLETE, FIXED
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  is2FAEnabled,
  generateOTP,
  storeOTP,
  sendOTPEmail
} from '../utils/Twofactorauth';
import {
  createSession,
  validateSession,
  deleteSession,
  updateSessionActivity
} from '../utils/sessionManager';
import { isDeviceTrusted, trustDevice } from '../utils/deviceTrust';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [is2FAPending, setIs2FAPending] = useState(false); // 🆕 Exposed to block redirects
  const is2FAPendingRef = useRef(false); // Sync flag for listener

  // ─────────────────────────────────────────────────────────
  // 1️⃣ AUTH STATE LISTENER – Handles 2FA & session creation
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (is2FAPendingRef.current) {
        setLoading(false);
        return;
      }

      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (!userDoc.exists()) {
            console.error('User document not found');
            await firebaseSignOut(auth);
            setLoading(false);
            return;
          }

          const userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            ...userDoc.data()
          };

          // ✅ 2FA CHECK – if enabled and not yet pending, start OTP flow
          if (userData.twoFactorEnabled === true && !pendingUser) {
            // 🆕 Check if this device is already trusted
            const trusted = await isDeviceTrusted(firebaseUser.uid);
            if (trusted) {
              console.log('✅ Device trusted – bypassing 2FA');
              // Proceed with normal login (create session)
              const sessionResult = await createSession(
                firebaseUser.uid,
                userData.email,
                userData.name
              );
              if (sessionResult.success) {
                setUser(userData);
                setSessionId(sessionResult.sessionId);
              }
              setLoading(false);
              return;
            }

            // Not trusted → start OTP flow
            const otp = generateOTP();
            await storeOTP(firebaseUser.uid, userData.email, otp);
            await sendOTPEmail(userData.email, otp, userData.name);

            is2FAPendingRef.current = true;
            setIs2FAPending(true);
            setPendingUser(userData);
            setShow2FAModal(true);
            setLoading(false);
            return;
          }

          // ─────────────────────────────────────────────────
          // No 2FA → normal login / session restore
          // ─────────────────────────────────────────────────
          const currentSessionId = localStorage.getItem('sessionId');
          if (currentSessionId) {
            const sessionValidation = await validateSession(currentSessionId);
            if (!sessionValidation.valid) {
              console.log('Session invalid, logging out...');
              await handleLogout();
              setLoading(false);
              return;
            }
          }

          const sessionResult = await createSession(
            firebaseUser.uid,
            userData.email,
            userData.name
          );

          if (sessionResult.success) {
            setUser(userData);
            setSessionId(sessionResult.sessionId);
          } else {
            console.error('Failed to create session');
          }
        } catch (error) {
          console.error('Auth state error:', error);
        }
      } else {
        // User is signed out
        setUser(null);
        setSessionId(null);
        localStorage.removeItem('sessionId');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─────────────────────────────────────────────────────────
  // 2️⃣ 2FA VERIFIED CALLBACK
  // ─────────────────────────────────────────────────────────
  const handle2FAVerified = async (trustDeviceFlag = false) => {
    if (!pendingUser) return;

    // 🆕 Save trusted device if user opted in
    if (trustDeviceFlag) {
      await trustDevice(pendingUser.uid);
    }

    const sessionResult = await createSession(
      pendingUser.uid,
      pendingUser.email,
      pendingUser.name
    );

    if (sessionResult.success) {
      setUser(pendingUser);
      setSessionId(sessionResult.sessionId);
      setShow2FAModal(false);
      setPendingUser(null);
      setIs2FAPending(false);
      is2FAPendingRef.current = false;
    } else {
      alert('Failed to create session. Please try again.');
    }
  };

  // ─────────────────────────────────────────────────────────
  // 3️⃣ SIGN IN – Now just calls Firebase Auth
  // ─────────────────────────────────────────────────────────
  const signIn = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Unknown error';
      if (error.code === 'auth/wrong-password') errorMessage = 'Invalid credentials';
      else if (error.code === 'auth/user-not-found') errorMessage = 'No account found with this email';
      else if (error.code === 'auth/too-many-requests') errorMessage = 'Too many failed attempts. Try again later.';
      else if (error.message) errorMessage = error.message;
      return { success: false, error: errorMessage };
    }
  };

  // ─────────────────────────────────────────────────────────
  // 4️⃣ SIGN UP – Always returns clear error messages
  // ─────────────────────────────────────────────────────────
  const signUp = async (email, password, userData) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        ...userData,
        email: firebaseUser.email,
        createdAt: new Date().toISOString(),
        twoFactorEnabled: false
      });

      const sessionResult = await createSession(
        firebaseUser.uid,
        firebaseUser.email,
        userData.name
      );

      if (!sessionResult.success) throw new Error('Failed to create session. Please try again.');

      const newUser = { uid: firebaseUser.uid, email: firebaseUser.email, ...userData };
      setUser(newUser);
      setSessionId(sessionResult.sessionId);
      return { success: true };
    } catch (error) {
      console.error('❌ Signup error:', error);
      let errorMessage = 'Unknown error during signup';
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Email is already registered.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password should be at least 6 characters.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address.';
            break;
          default:
            errorMessage = error.message || 'Signup failed.';
        }
      } else {
        errorMessage = error.message || 'Signup failed.';
      }
      return { success: false, error: errorMessage };
    }
  };

  // ─────────────────────────────────────────────────────────
  // 5️⃣ LOGOUT
  // ─────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      const currentSessionId = localStorage.getItem('sessionId');
      if (currentSessionId && user) {
        await deleteSession(user.uid, currentSessionId);
      }
      await firebaseSignOut(auth);
      setUser(null);
      setSessionId(null);
      localStorage.removeItem('sessionId');
      setIs2FAPending(false);
      is2FAPendingRef.current = false;
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // ─────────────────────────────────────────────────────────
  // 6️⃣ ACTIVITY MONITORING – keep session alive
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const activityInterval = setInterval(() => {
      const currentSessionId = localStorage.getItem('sessionId');
      if (currentSessionId && user) updateSessionActivity(currentSessionId);
    }, 60000);

    const handleActivity = () => {
      const currentSessionId = localStorage.getItem('sessionId');
      if (currentSessionId) updateSessionActivity(currentSessionId);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);

    return () => {
      clearInterval(activityInterval);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
    };
  }, [user]);

  const value = {
    user,
    loading,
    sessionId,
    signIn,
    signUp,
    logout: handleLogout,
    show2FAModal,
    setShow2FAModal,
    pendingUser,
    handle2FAVerified,
    is2FAPending, // 🆕 EXPOSED – used in App.jsx to block redirects
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};