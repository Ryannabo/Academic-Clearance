// src/components/Login.jsx – COMPLETE with Password Toggle
import React, { useState, useEffect } from 'react';
import {
  FileText, Shield, Mail, AlertCircle,
  Eye, EyeOff  // ✅ added eye icons for password toggle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import DarkModeToggle from './DarkModeToggle';
import TwoFactorModal from './TwoFactorModal';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

const departments = [
  { id: 'library', name: 'Library', subRole: 'dept_library' },
  { id: 'course_office', name: 'Course Office', subRole: 'dept_course_office' },
  { id: 'guidance', name: 'Guidance', subRole: 'dept_guidance' },
  { id: 'student_council', name: 'Student Council', subRole: 'dept_student_council' },
  { id: 'finance', name: 'Finance', subRole: 'dept_finance' },
  { id: 'student_government', name: 'Student Government', subRole: 'dept_student_government' },
  { id: 'cashier', name: 'Cashier', subRole: 'dept_cashier' }
];

const courses = [
  'BS Computer Science', 'BS Information Technology', 'BS Computer Engineering',
  'BS Mechanical Engineering', 'BS Accountancy', 'BS Business Administration',
  'BS Hospitality Management', 'BS Tourism Management', 'BS Nursing',
  'BS Psychology', 'BS Education',
];

const sections = ['A', 'B', 'C', 'D', 'E'];

export default function Login() {
  const {
    signIn,
    signUp,
    error,
    show2FAModal,
    setShow2FAModal,
    pendingUser,
    handle2FAVerified,
    is2FAPending,
    user
  } = useAuth();

  const { darkMode } = useTheme();
  const [isSignup, setIsSignup] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [formData, setFormData] = useState({
    email: '', password: '', role: 'student', name: '', studentId: '',
    course: '', yearLevel: '', section: '', departmentToken: ''
  });
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [studentIdError, setStudentIdError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [signupOTP, setSignupOTP] = useState('');
  const [pendingSignupData, setPendingSignupData] = useState(null);
  const [emailError, setEmailError] = useState('');

  // ✅ Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  // (Confirm password not used – kept for future extension)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  // 🚫 COMPLETELY REMOVE SCROLLBARS ON LOGIN PAGE
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalRootOverflow = document.getElementById('root')?.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const root = document.getElementById('root');
    if (root) root.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      if (root) root.style.overflow = originalRootOverflow || '';
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'studentId') {
      let formatted = value.replace(/[^\d-]/g, '');
      if (formatted.length <= 4) formatted = formatted;
      else if (formatted.length === 5 && !formatted.includes('-')) {
        formatted = formatted.slice(0, 4) + '-' + formatted.slice(4);
      } else if (formatted.includes('-')) {
        const parts = formatted.split('-');
        if (parts[1] && parts[1].length > 6) parts[1] = parts[1].slice(0, 6);
        formatted = parts.join('-');
      }
      setFormData({ ...formData, [name]: formatted });
      setStudentIdError('');
    } else {
      setFormData({ ...formData, [name]: value });
    }
    if (name === 'departmentToken') setTokenError('');
    if (name === 'email') setEmailError('');
  };

  const validateStudentIdFormat = (studentId) => /^\d{4}-\d{1,6}$/.test(studentId);
  const checkStudentIdExists = async (studentId) => {
    try {
      const idDoc = await getDoc(doc(db, 'student_ids', studentId));
      return idDoc.exists();
    } catch { return false; }
  };
  const checkEmailExists = async (email) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch { return false; }
  };
  const verifyToken = async (token, department) => {
    try {
      const tokensQuery = query(
        collection(db, 'department_tokens'),
        where('token', '==', token),
        where('department', '==', department)
      );
      const snapshot = await getDocs(tokensQuery);
      if (snapshot.empty) return { valid: false, message: 'Invalid token' };
      const tokenDoc = snapshot.docs[0];
      const tokenData = tokenDoc.data();
      if (tokenData.used) return { valid: false, message: 'Token has already been used' };
      if (new Date(tokenData.expiresAt) < new Date()) return { valid: false, message: 'Token has expired' };
      return { valid: true, tokenId: tokenDoc.id };
    } catch (error) {
      return { valid: false, message: 'Error verifying token: ' + error.message };
    }
  };

  const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
  const sendSignupOTPEmail = async (email, otp, userName) => {
    try {
      const emailjs = await import('@emailjs/browser');
      const serviceId = 'service_wqfpk9k';
      const templateId = 'template_npgf824';
      const publicKey = 'vBQxZ_dv3-mZzSw8M';

      const templateParams = {
        to_email: email,
        to_name: userName,
        otp_code: otp,
        expiry_minutes: '10',
        app_name: 'Academic Clearance System'
      };

      console.log('📧 Sending signup OTP with:', { serviceId, templateId, publicKey, email });

      const response = await emailjs.send(
        serviceId,
        templateId,
        templateParams,
        publicKey
      );

      console.log('✅ Signup OTP sent successfully:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send signup OTP:', error);
      let errorMessage = error.message || 'Unknown error';
      if (error.text) errorMessage = error.text;
      return { success: false, error: errorMessage };
    }
  };

  const handleSignupSubmit = async () => {
    setLoading(true);
    setTokenError(''); setStudentIdError(''); setEmailError('');
    try {
      if (await checkEmailExists(formData.email)) {
        setEmailError('This email is already registered. Please use a different email or sign in.');
        setLoading(false); return;
      }
      let tokenId = null;
      if (formData.role !== 'student') {
        const verification = await verifyToken(formData.departmentToken, formData.role);
        if (!verification.valid) { setTokenError(verification.message); setLoading(false); return; }
        tokenId = verification.tokenId;
      }
      if (formData.role === 'student') {
        if (!formData.studentId || !formData.course || !formData.yearLevel || !formData.section) {
          alert('Please fill in all student information including section');
          setLoading(false); return;
        }
        if (!validateStudentIdFormat(formData.studentId)) {
          setStudentIdError('Invalid Student ID format. Use: YYYY-NNNNNN (e.g., 2022-01132)');
          setLoading(false); return;
        }
        if (await checkStudentIdExists(formData.studentId)) {
          setStudentIdError('This Student ID is already registered. Please contact the administrator if this is an error.');
          setLoading(false); return;
        }
      }
      const userData = { role: formData.role, name: formData.name };
      if (formData.role === 'student') {
        userData.studentId = formData.studentId;
        userData.course = formData.course;
        userData.yearLevel = formData.yearLevel;
        userData.section = formData.section;
      } else {
        userData.department = formData.role;
        userData.tokenId = tokenId;
      }
      const otp = generateOTP();
      const emailResult = await sendSignupOTPEmail(formData.email, otp, formData.name);
      if (!emailResult.success) {
        alert('Failed to send OTP email. Please try again.');
        setLoading(false); return;
      }
      setSignupOTP(otp);
      setPendingSignupData({ email: formData.email, password: formData.password, userData });
      setShowOTPVerification(true);
      setOtpTimer(60);
    } catch (err) {
      console.error('Signup error:', err);
      alert('Signup failed: ' + err.message);
    } finally { setLoading(false); }
  };

  const handleOTPVerification = async () => {
    if (otpCode.length !== 6) { alert('Please enter a valid 6-digit OTP'); return; }
    if (otpCode !== signupOTP) { alert('Invalid OTP. Please check the code sent to your email.'); return; }
    setLoading(true);
    try {
      const result = await signUp(
        pendingSignupData.email,
        pendingSignupData.password,
        pendingSignupData.userData
      );
      if (result.success) {
        alert('✅ Account created successfully! You can now login.');
        setShowOTPVerification(false);
        setIsSignup(false);
        setFormData({ email: '', password: '', role: 'student', name: '', studentId: '', course: '', yearLevel: '', section: '', departmentToken: '' });
        setOtpCode(''); setSignupOTP(''); setPendingSignupData(null);
      } else {
        alert(`❌ Failed to create account: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('🔥 Unexpected signup error:', err);
      alert(`❌ Failed to create account: ${err.message || 'Unknown error'}`);
    } finally { setLoading(false); }
  };

  const handleResendOTP = async () => {
    if (!pendingSignupData) return;
    try {
      const otp = generateOTP();
      const emailResult = await sendSignupOTPEmail(pendingSignupData.email, otp, pendingSignupData.userData.name);
      if (emailResult.success) {
        setSignupOTP(otp);
        setOtpTimer(60);
        alert('✅ New OTP sent to your email!');
      } else alert('Failed to resend OTP. Please try again.');
    } catch (err) {
      console.error('Resend OTP error:', err);
      alert('Failed to resend OTP: ' + err.message);
    }
  };

  // 🚫 NO ALERT ON SUCCESSFUL 2FA INITIATION
  const handleLoginSubmit = async () => {
    setLoading(true);
    try {
      const result = await signIn(formData.email, formData.password);
      if (!result.success) {
        alert('Login failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Login failed: ' + err.message);
    } finally { setLoading(false); }
  };

  // ─────────────────────────────────────────────────────────
  // SIGNUP OTP SCREEN
  // ─────────────────────────────────────────────────────────
  if (showOTPVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:via-indigo-950 dark:to-gray-900 flex items-center justify-center p-4 transition-colors duration-300">
        <div className="absolute top-4 right-4"><DarkModeToggle /></div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md transition-colors duration-300">
          <div className="text-center mb-8">
            <div className="bg-indigo-600 dark:bg-indigo-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Verify Your Email</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              We've sent a 6-digit code to<br />
              <span className="font-semibold text-gray-800 dark:text-gray-200">{formData.email}</span>
            </p>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enter OTP Code</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                maxLength="6"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">Code expires in 10 minutes</p>
            </div>
            <button
              onClick={handleOTPVerification}
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:bg-indigo-400 dark:disabled:bg-indigo-700 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>
            <div className="text-center">
              {otpTimer > 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">Resend code in {otpTimer} seconds</p>
              ) : (
                <button onClick={handleResendOTP} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium">
                  Resend OTP
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setShowOTPVerification(false);
                setOtpCode('');
                setSignupOTP('');
                setPendingSignupData(null);
              }}
              className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
            >
              ← Back to signup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // MAIN LOGIN/SIGNUP SCREEN
  // ─────────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:via-indigo-950 dark:to-gray-900 flex items-center justify-center p-4 overflow-hidden transition-colors duration-300">
        <div className="absolute top-4 right-4"><DarkModeToggle /></div>
        <div className={`
          bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 w-full transition-colors duration-300
          ${isSignup ? 'max-w-2xl' : 'max-w-md'}
        `}>
          <div className="text-center mb-8">
            <div className="bg-indigo-600 dark:bg-indigo-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Academic Clearance</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {isSignup ? 'Create your account' : 'Sign in to your account'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          {emailError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-600 dark:text-red-400">{emailError}</p>
            </div>
          )}
          {tokenError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{tokenError}</p>
            </div>
          )}
          {studentIdError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-600 dark:text-red-400">{studentIdError}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              {/* Email field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                <input
                  type="email" name="email" value={formData.email} onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                  placeholder="Enter your email" required
                />
              </div>

              {/* ✅ Password field with toggle (Login & Signup) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                    placeholder={isSignup ? 'Create a password' : 'Enter your password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            {isSignup && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                    <input
                      type="text" name="name" value={formData.name} onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                      placeholder="Enter your full name" required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
                    <select name="role" value={formData.role} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent">
                      <option value="student">Student</option>
                      {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                    </select>
                  </div>
                </div>

                {formData.role === 'student' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Student ID <span className="text-red-600 dark:text-red-400">*</span>
                        </label>
                        <input
                          type="text" name="studentId" value={formData.studentId} onChange={handleChange}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${studentIdError ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
                            }`}
                          placeholder="2022-01132" maxLength="11" required
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Format: YYYY-NNNNNN (e.g., 2022-01132)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Course</label>
                        <select name="course" value={formData.course} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent" required>
                          <option value="">Select Course</option>
                          {courses.map(course => <option key={course} value={course}>{course}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Year Level</label>
                        <select name="yearLevel" value={formData.yearLevel} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent" required>
                          <option value="">Select Year</option>
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                          <option value="5th Year">5th Year</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Section <span className="text-red-600 dark:text-red-400">*</span>
                        </label>
                        <select name="section" value={formData.section} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent" required>
                          <option value="">Select Section</option>
                          {sections.map(section => <option key={section} value={section}>{section}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {formData.role !== 'student' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Department Access Token <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <input
                      type="text" name="departmentToken" value={formData.departmentToken} onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                      placeholder="Enter token provided by admin" required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Contact admin to get your department access token</p>
                  </div>
                )}
              </>
            )}

            <button
              onClick={isSignup ? handleSignupSubmit : handleLoginSubmit}
              disabled={loading}
              className="w-full bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:bg-indigo-400 dark:disabled:bg-indigo-700 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : (isSignup ? 'Send OTP' : 'Sign In')}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setTokenError(''); setStudentIdError(''); setEmailError('');
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
              >
                {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>

          {!isSignup && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                <Shield className="inline mr-1" size={14} />
                Admin access? Contact system administrator
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ✅ 2FA MODAL */}
      <TwoFactorModal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        onVerified={handle2FAVerified}
        userEmail={pendingUser?.email}
        userId={pendingUser?.uid}
        userName={pendingUser?.name}
      />
    </>
  );
}