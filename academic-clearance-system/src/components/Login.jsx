// src/components/Login.jsx (Final Version)
import React, { useState } from 'react';
import { FileText, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
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

export default function Login() {
  const { login, signup, error } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'student',
    name: '',
    studentId: '',
    course: '',
    yearLevel: '',
    semester: '',
    departmentToken: ''
  });
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (e.target.name === 'departmentToken') {
      setTokenError('');
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

      // Return token info - will be marked as used after user is created
      return { valid: true, tokenId: tokenDoc.id };
    } catch (error) {
      console.error('Error verifying token:', error);
      return { valid: false, message: 'Error verifying token: ' + error.message };
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setTokenError('');

    try {
      if (isSignup) {
        let tokenId = null;
        
        // Verify token for department signups (but don't mark as used yet)
        if (formData.role !== 'student') {
          const verification = await verifyToken(formData.departmentToken, formData.role);
          
          if (!verification.valid) {
            setTokenError(verification.message);
            setLoading(false);
            return;
          }
          
          tokenId = verification.tokenId;
        }

        const userData = {
          role: formData.role,
          name: formData.name
        };

        if (formData.role === 'student') {
          if (!formData.studentId || !formData.course || !formData.yearLevel || !formData.semester) {
            alert('Please fill in all student information');
            setLoading(false);
            return;
          }
          userData.studentId = formData.studentId;
          userData.course = formData.course;
          userData.yearLevel = formData.yearLevel;
          userData.semester = formData.semester;
        } else {
          userData.department = formData.role;
          userData.tokenId = tokenId; // Store token ID to mark as used later
        }

        await signup(formData.email, formData.password, userData);
        
        // Mark token as used after successful signup (via AuthContext)
      } else {
        await login(formData.email, formData.password);
      }
    } catch (err) {
      console.error('Authentication error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
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

        <div className="space-y-4">
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

          {isSignup && (
            <>
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

              {formData.role === 'student' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Student ID</label>
                    <input
                      type="text"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., 2024-00001"
                      required
                    />
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Year Level</label>
                    <select
                      name="yearLevel"
                      value={formData.yearLevel}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Year Level</option>
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
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
          >
            {loading ? 'Please wait...' : (isSignup ? 'Sign Up' : 'Sign In')}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setTokenError('');
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