// src/components/Login.jsx (Updated with Section & Unique Student ID Validation)
import React, { useState, useEffect } from 'react';
import { FileText, Shield, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
  'BS Computer Science',
  'BS Information Technology',
  'BS Computer Engineering',
  'BS Electronics Engineering',
  'BS Civil Engineering',
  'BS Mechanical Engineering',
  'BS Electrical Engineering',
  'BS Architecture',
  'BS Accountancy',
  'BS Business Administration',
  'BS Hospitality Management',
  'BS Tourism Management',
  'BS Nursing',
  'BS Psychology',
  'BS Education',
  'BS Mathematics',
  'BS Biology',
  'BS Chemistry',
  'BA Communication',
  'BA Political Science'
];

// Section options - can be adjusted based on availability
const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function Login() {
  const { login, sendOTPForSignup, verifyOTPAndSignup, resendOTP, error } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'student',
    name: '',
    studentId: '',
    course: '',
    yearLevel: '',
    semester: '',
    section: '',
    departmentToken: ''
  });
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [studentIdError, setStudentIdError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  // Timer for resend OTP
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Format Student ID as user types
    if (name === 'studentId') {
      // Remove any non-digit characters except hyphen
      let formatted = value.replace(/[^\d-]/g, '');
      
      // Format as YYYY-NNNNNN
      if (formatted.length <= 4) {
        // Just the year part
        formatted = formatted;
      } else if (formatted.length === 5 && !formatted.includes('-')) {
        // Add hyphen after year
        formatted = formatted.slice(0, 4) + '-' + formatted.slice(4);
      } else if (formatted.includes('-')) {
        // Already has hyphen, limit the number part to 6 digits
        const parts = formatted.split('-');
        if (parts[1] && parts[1].length > 6) {
          parts[1] = parts[1].slice(0, 6);
        }
        formatted = parts.join('-');
      }
      
      setFormData({
        ...formData,
        [name]: formatted
      });
      setStudentIdError('');
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    
    if (name === 'departmentToken') {
      setTokenError('');
    }
  };

  // Validate Student ID format
  const validateStudentIdFormat = (studentId) => {
    // Format: YYYY-NNNNNN (year-number, where number is 1-6 digits)
    const regex = /^\d{4}-\d{1,6}$/;
    return regex.test(studentId);
  };

  const checkStudentIdExists = async (studentId) => {
  try {
    // Check the student_ids registry collection (not students collection)
    const idDoc = await getDoc(doc(db, 'student_ids', studentId));
    
    console.log(`Checking Student ID: ${studentId}`);
    console.log(`Exists in registry: ${idDoc.exists()}`);
    
    return idDoc.exists(); // Returns true if exists
  } catch (error) {
    console.error('Error checking student ID:', error);
    // If there's an error, assume it doesn't exist to allow signup
    return false;
  }
};

  const verifyToken = async (token, department) => {
    try {
      const tokensQuery = query(
        collection(db, 'department_tokens'),
        where('token', '==', token),
        where('department', '==', department)
      );
      
      const snapshot = await getDocs(tokensQuery);
      
      if (snapshot.empty) {
        return { valid: false, message: 'Invalid token' };
      }

      const tokenDoc = snapshot.docs[0];
      const tokenData = tokenDoc.data();

      if (tokenData.used) {
        return { valid: false, message: 'Token has already been used' };
      }

      const expiryDate = new Date(tokenData.expiresAt);
      if (expiryDate < new Date()) {
        return { valid: false, message: 'Token has expired' };
      }

      return { valid: true, tokenId: tokenDoc.id };
    } catch (error) {
      console.error('Error verifying token:', error);
      return { valid: false, message: 'Error verifying token: ' + error.message };
    }
  };

  const handleSignupSubmit = async () => {
    setLoading(true);
    setTokenError('');
    setStudentIdError('');

    try {
      let tokenId = null;
      
      // Verify token for department signups
      if (formData.role !== 'student') {
        const verification = await verifyToken(formData.departmentToken, formData.role);
        
        if (!verification.valid) {
          setTokenError(verification.message);
          setLoading(false);
          return;
        }
        
        tokenId = verification.tokenId;
      }

      // Validate student information
      if (formData.role === 'student') {
        // Check all required fields
        if (!formData.studentId || !formData.course || !formData.yearLevel || !formData.semester || !formData.section) {
          alert('Please fill in all student information including section');
          setLoading(false);
          return;
        }

        // Validate Student ID format
        if (!validateStudentIdFormat(formData.studentId)) {
          setStudentIdError('Invalid Student ID format. Use: YYYY-NNNNNN (e.g., 2022-01132)');
          setLoading(false);
          return;
        }

        // Check if Student ID already exists
        const idExists = await checkStudentIdExists(formData.studentId);
        if (idExists) {
          setStudentIdError('This Student ID is already registered. Please contact the administrator if this is an error.');
          setLoading(false);
          return;
        }
      }

      const userData = {
        role: formData.role,
        name: formData.name
      };

      if (formData.role === 'student') {
        userData.studentId = formData.studentId;
        userData.course = formData.course;
        userData.yearLevel = formData.yearLevel;
        userData.semester = formData.semester;
        userData.section = formData.section;
      } else {
        userData.department = formData.role;
        userData.tokenId = tokenId;
      }

      // Send OTP
      await sendOTPForSignup(formData.email, userData);
      setShowOTPVerification(true);
      setOtpTimer(60); // 60 seconds before resend
      
    } catch (err) {
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerification = async () => {
    if (otpCode.length !== 6) {
      alert('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      await verifyOTPAndSignup(formData.email, otpCode, formData.password);
      alert('Account created successfully! You can now login.');
      setShowOTPVerification(false);
      setIsSignup(false);
      setFormData({
        email: '',
        password: '',
        role: 'student',
        name: '',
        studentId: '',
        course: '',
        yearLevel: '',
        semester: '',
        section: '',
        departmentToken: ''
      });
      setOtpCode('');
    } catch (err) {
      console.error('OTP verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      await resendOTP(formData.email);
      setOtpTimer(60);
    } catch (err) {
      console.error('Resend OTP error:', err);
    }
  };

  const handleLoginSubmit = async () => {
    setLoading(true);
    try {
      await login(formData.email, formData.password);
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (showOTPVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Verify Your Email</h1>
            <p className="text-gray-600 mt-2">
              We've sent a 6-digit code to<br />
              <span className="font-semibold">{formData.email}</span>
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter OTP Code
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                maxLength="6"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Code expires in 10 minutes
              </p>
            </div>

            <button
              onClick={handleOTPVerification}
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
            >
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>

            <div className="text-center">
              {otpTimer > 0 ? (
                <p className="text-sm text-gray-600">
                  Resend code in {otpTimer} seconds
                </p>
              ) : (
                <button
                  onClick={handleResendOTP}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  Resend OTP
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setShowOTPVerification(false);
                setOtpCode('');
              }}
              className="w-full text-gray-600 hover:text-gray-700 text-sm"
            >
              ← Back to signup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Academic Clearance</h1>
          <p className="text-gray-600 mt-2">
            {isSignup ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {tokenError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{tokenError}</p>
          </div>
        )}

        {studentIdError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-600">{studentIdError}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          {isSignup && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="student">Student</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.role === 'student' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Student ID <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        name="studentId"
                        value={formData.studentId}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                          studentIdError ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="2022-01132"
                        maxLength="11"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Format: YYYY-NNNNNN (e.g., 2022-01132)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                      <select
                        name="course"
                        value={formData.course}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select Course</option>
                        {courses.map(course => (
                          <option key={course} value={course}>{course}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Year Level</label>
                      <select
                        name="yearLevel"
                        value={formData.yearLevel}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select Year</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                        <option value="5th Year">5th Year</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                      <select
                        name="semester"
                        value={formData.semester}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select Semester</option>
                        <option value="1st Semester">1st Semester</option>
                        <option value="2nd Semester">2nd Semester</option>
                        <option value="Summer">Summer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Section <span className="text-red-600">*</span>
                      </label>
                      <select
                        name="section"
                        value={formData.section}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select Section</option>
                        {sections.map(section => (
                          <option key={section} value={section}>{section}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {formData.role !== 'student' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department Access Token <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="departmentToken"
                    value={formData.departmentToken}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter token provided by admin"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Contact admin to get your department access token
                  </p>
                </div>
              )}
            </>
          )}

          <button
            onClick={isSignup ? handleSignupSubmit : handleLoginSubmit}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
          >
            {loading ? 'Please wait...' : (isSignup ? 'Send OTP' : 'Sign In')}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setTokenError('');
                setStudentIdError('');
              }}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
            >
              {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>

        {!isSignup && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              <Shield className="inline mr-1" size={14} />
              Admin access? Contact system administrator
            </p>
          </div>
        )}
      </div>
    </div>
  );
}