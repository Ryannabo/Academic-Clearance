// src/context/AuthContext.jsx (Updated to support Section)
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
      
      // Store OTP in Firestore
      await setDoc(doc(db, 'pending_verifications', email), {
        otp,
        email,
        userData,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString()
      });
      
      console.log('📧 Attempting to send OTP email...');
      
      // Try to send email
      const emailSent = await sendOTPEmail(email, otp, userData.name);
      
      if (emailSent) {
        alert(`✅ OTP sent to ${email}!\n\nPlease check your inbox (and spam folder).`);
      } else {
        // Fallback for demo/testing
        console.warn('⚠️ Email not sent, showing OTP in console');
        alert(`⚠️ Email service not configured.\n\nYour OTP is: ${otp}\n\n(Check browser console)`);
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
    
    // For students, check Student ID one more time before creating account
    if (verificationData.userData.role === 'student') {
      const studentId = verificationData.userData.studentId;
      
      // Check if ID was registered while user was entering OTP
      const idDoc = await getDoc(doc(db, 'student_ids', studentId));
      if (idDoc.exists()) {
        await deleteDoc(doc(db, 'pending_verifications', email));
        throw new Error('This Student ID was just registered by another user. Please contact the administrator.');
      }
      
      // Register the Student ID first (atomically)
      try {
        await setDoc(doc(db, 'student_ids', studentId), {
          userId: 'pending', // Temporary, will update after user creation
          email: email,
          registeredAt: new Date().toISOString()
        });
      } catch (idError) {
        console.error('Error registering student ID:', idError);
        throw new Error('This Student ID is already in use. Please contact the administrator.');
      }
    }
    
    // Create user account
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (authError) {
      // If user creation fails, remove the student ID registration
      if (verificationData.userData.role === 'student') {
        await deleteDoc(doc(db, 'student_ids', verificationData.userData.studentId));
      }
      throw authError;
    }
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email,
      ...verificationData.userData,
      emailVerified: true,
      createdAt: new Date().toISOString()
    });

    // If student, create student document and update student_ids
    if (verificationData.userData.role === 'student') {
      const studentId = verificationData.userData.studentId;
      
      await setDoc(doc(db, 'students', userCredential.user.uid), {
        name: verificationData.userData.name,
        studentId: studentId,
        course: verificationData.userData.course,
        yearLevel: verificationData.userData.yearLevel,
        semester: verificationData.userData.semester,
        section: verificationData.userData.section,
        email: email,
        createdAt: new Date().toISOString()
      });
      
      // Update student_ids with actual userId
      await updateDoc(doc(db, 'student_ids', studentId), {
        userId: userCredential.user.uid,
        updatedAt: new Date().toISOString()
      });
    }
    
    // Mark token as used (only for department signups)
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
    
    // Delete pending verification
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
      
      console.log('📧 Attempting to resend OTP email...');
      
      // Try to send email
      const emailSent = await sendOTPEmail(email, otp, verificationData.userData.name);
      
      if (emailSent) {
        alert(`✅ New OTP sent to ${email}!`);
      } else {
        console.warn('⚠️ Email not sent, showing OTP in console');
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