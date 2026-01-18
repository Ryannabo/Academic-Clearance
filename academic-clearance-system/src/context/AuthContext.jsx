import React, { createContext, useState, useEffect, useContext } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { generateOTP, sendOTPEmail } from '../utils/emailOTP';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              ...userDoc.data()
            });
          } else {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email
            });
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const sendOTPForSignup = async (email, userData) => {
  try {
    setError(null);
    
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Store OTP in Firestore first
    await setDoc(doc(db, 'pending_verifications', email), {
      otp,
      email,
      userData,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString()
    });
    
    // Try to send email
    const emailSent = await sendOTPEmail(email, otp, userData.name);
    
    if (emailSent) {
      alert(`✅ OTP sent to ${email}. Please check your inbox (and spam folder).`);
    } else {
      // Fallback: show OTP in alert for testing
      console.log(`Development Mode - OTP: ${otp}`);
      alert(`⚠️ Email service not configured.\n\nYour OTP is: ${otp}\n\n(Check console for details)`);
    }
    
    return true;
  } catch (err) {
    console.error('Error in sendOTPForSignup:', err);
    setError(err.message);
    throw err;
  }
};

  const verifyOTPAndSignup = async (email, otp, password) => {
    try {
      setError(null);
      
      const verificationDoc = await getDoc(doc(db, 'pending_verifications', email));
      
      if (!verificationDoc.exists()) {
        throw new Error('No pending verification found. Please request a new OTP.');
      }
      
      const verificationData = verificationDoc.data();
      
      if (new Date(verificationData.expiresAt) < new Date()) {
        await deleteDoc(doc(db, 'pending_verifications', email));
        throw new Error('OTP has expired. Please request a new one.');
      }
      
      if (verificationData.otp !== otp) {
        throw new Error('Invalid OTP. Please try again.');
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email,
        ...verificationData.userData,
        emailVerified: true,
        createdAt: new Date().toISOString()
      });

      if (verificationData.userData.role === 'student') {
        await setDoc(doc(db, 'students', userCredential.user.uid), {
          name: verificationData.userData.name,
          studentId: verificationData.userData.studentId,
          course: verificationData.userData.course,
          yearLevel: verificationData.userData.yearLevel,
          semester: verificationData.userData.semester,
          email: email,
          createdAt: new Date().toISOString()
        });
      }
      
      if (verificationData.userData.tokenId) {
        try {
          await updateDoc(doc(db, 'department_tokens', verificationData.userData.tokenId), {
            used: true,
            usedAt: new Date().toISOString(),
            usedBy: email
          });
        } catch (tokenError) {
          console.error('Error marking token as used:', tokenError);
        }
      }
      
      await deleteDoc(doc(db, 'pending_verifications', email));
      
      return userCredential.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const resendOTP = async (email) => {
  try {
    setError(null);
    
    const verificationDoc = await getDoc(doc(db, 'pending_verifications', email));
    
    if (!verificationDoc.exists()) {
      throw new Error('No pending verification found. Please restart signup.');
    }
    
    const verificationData = verificationDoc.data();
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    // Update OTP in Firestore
    await updateDoc(doc(db, 'pending_verifications', email), {
      otp,
      expiresAt: expiresAt.toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Try to send email
    const emailSent = await sendOTPEmail(email, otp, verificationData.userData.name);
    
    if (emailSent) {
      alert(`✅ New OTP sent to ${email}. Please check your inbox.`);
    } else {
      console.log(`Development Mode - New OTP: ${otp}`);
      alert(`⚠️ Email service not configured.\n\nYour new OTP is: ${otp}`);
    }
    
    return true;
  } catch (err) {
    console.error('Error in resendOTP:', err);
    setError(err.message);
    throw err;
  }
};

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    sendOTPForSignup,
    verifyOTPAndSignup,
    resendOTP,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};