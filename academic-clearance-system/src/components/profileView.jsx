// src/components/ProfileView.jsx
import React, { useState, useEffect } from 'react';
import {
  X, User, Mail, Book, Calendar, Edit2, Save,
  School, Hash, Shield, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import SecuritySettings from './SecuritySettings';

export default function ProfileView({ isOpen, onClose }) {
  // ---------- YOUR EXACT LOGIC (unchanged) ----------
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchProfileData();
    }
  }, [isOpen, user]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfileData(userData);
        setEditedData(userData);

        if (userData.role === 'student') {
          const studentDoc = await getDoc(doc(db, 'students', user.uid));
          if (studentDoc.exists()) {
            const studentData = studentDoc.data();
            setProfileData({ ...userData, ...studentData });
            setEditedData({ ...userData, ...studentData });
          }
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditedData(profileData);
  };

  const handleChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: editedData.name,
        email: editedData.email,
        updatedAt: new Date().toISOString()
      });

      if (profileData.role === 'student') {
        await updateDoc(doc(db, 'students', user.uid), {
          name: editedData.name,
          email: editedData.email,
          course: editedData.course,
          yearLevel: editedData.yearLevel,
          semester: editedData.semester,
          section: editedData.section,
          updatedAt: new Date().toISOString()
        });
      }

      setProfileData(editedData);
      setEditing(false);
      alert('✅ Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('❌ Failed to update profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  // ---------- END OF YOUR LOGIC ----------

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-lg">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
            <span className="text-sm text-gray-500 capitalize">
              {profileData?.role?.replace(/_/g, ' ') || 'Account'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
              <p className="mt-4 text-gray-600">Loading profile...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile header with avatar and inline edit */}
              <div className="flex items-start gap-4">
                {/* Avatar - fixed size, no overflow */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xl font-semibold shadow-sm">
                    {getInitials(profileData?.name)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 truncate">
                    {profileData?.name}
                  </h3>
                  <p className="text-gray-600 flex items-center gap-1.5 mt-0.5 text-sm truncate">
                    <Mail size={14} />
                    {profileData?.email}
                  </p>
                  {profileData?.role === 'student' && profileData?.studentId && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                      <Hash size={14} />
                      ID: {profileData.studentId}
                    </p>
                  )}
                </div>
                {!editing && (
                  <button
                    onClick={handleEdit}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <Edit2 size={15} />
                    Edit
                  </button>
                )}
              </div>

              {/* Edit mode actions */}
              {editing && (
                <div className="flex justify-end gap-3 pt-2 pb-1">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Basic Information Card */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <User size={14} className="text-indigo-500" />
                  Basic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Full name</label>
                    {editing ? (
                      <input
                        type="text"
                        value={editedData.name || ''}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        placeholder="Your full name"
                      />
                    ) : (
                      <div className="px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm">
                        {profileData?.name}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                    <div className="px-3 py-2 bg-gray-100 rounded-lg border border-gray-200 text-sm text-gray-600 flex items-center gap-2">
                      <Mail size={14} />
                      {profileData?.email}
                      <span className="text-xs text-gray-400 ml-auto">read-only</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Student Academic Information */}
              {profileData?.role === 'student' && (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Book size={14} className="text-indigo-500" />
                    Academic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Student ID</label>
                      <div className="px-3 py-2 bg-gray-100 rounded-lg border border-gray-200 text-sm text-gray-600">
                        {profileData?.studentId}
                        <span className="text-xs text-gray-400 ml-2">read-only</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Course / Program</label>
                      {editing ? (
                        <select
                          value={editedData.course || ''}
                          onChange={(e) => handleChange('course', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                          <option value="">Select course</option>
                          <option value="BS Computer Science">BS Computer Science</option>
                          <option value="BS Information Technology">BS Information Technology</option>
                          <option value="BS Computer Engineering">BS Computer Engineering</option>
                          <option value="BS Mechanical Engineering">BS Mechanical Engineering</option>
                          <option value="BS Accountancy">BS Accountancy</option>
                          <option value="BS Business Administration">BS Business Administration</option>
                          <option value="BS Hospitality Management">BS Hospitality Management</option>
                          <option value="BS Tourism Management">BS Tourism Management</option>
                          <option value="BS Nursing">BS Nursing</option>
                          <option value="BS Psychology">BS Psychology</option>
                          <option value="BS Education">BS Education</option>
                        </select>
                      ) : (
                        <div className="px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm">
                          {profileData?.course || '—'}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Year Level</label>
                      {editing ? (
                        <select
                          value={editedData.yearLevel || ''}
                          onChange={(e) => handleChange('yearLevel', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                          <option value="">Select year</option>
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                          <option value="5th Year">5th Year</option>
                        </select>
                      ) : (
                        <div className="px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm">
                          {profileData?.yearLevel || '—'}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Semester</label>
                      {editing ? (
                        <select
                          value={editedData.semester || ''}
                          onChange={(e) => handleChange('semester', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                          <option value="">Select semester</option>
                          <option value="1st Semester">1st Semester</option>
                          <option value="2nd Semester">2nd Semester</option>
                          <option value="Summer">Summer</option>
                        </select>
                      ) : (
                        <div className="px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm">
                          {profileData?.semester || '—'}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Section</label>
                      {editing ? (
                        <select
                          value={editedData.section || ''}
                          onChange={(e) => handleChange('section', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                          <option value="">Select section</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="E">E</option>
                        </select>
                      ) : (
                        <div className="px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm">
                          {profileData?.section || '—'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Department Information (non‑student, non‑admin) */}
              {profileData?.role !== 'student' && profileData?.role !== 'admin' && (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <School size={14} className="text-indigo-500" />
                    Department Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                      <div className="px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm capitalize">
                        {profileData?.department?.replace(/_/g, ' ') || '—'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                      <div className="px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm capitalize">
                        {profileData?.role?.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Timeline */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Clock size={14} className="text-indigo-500" />
                  Account Timeline
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Created</label>
                    <div className="px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm">
                      {profileData?.createdAt
                        ? new Date(profileData.createdAt).toLocaleString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })
                        : 'N/A'}
                    </div>
                  </div>
                  {profileData?.updatedAt && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Last updated</label>
                      <div className="px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm">
                        {new Date(profileData.updatedAt).toLocaleString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Security Section - Original, no extra buttons */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Shield size={14} className="text-indigo-500" />
                  Security
                </h4>
                <button
                  onClick={() => setShowSecurity(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Shield size={18} />
                  Two‑Factor Authentication
                </button>
                <div className="mt-4 bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs text-blue-700 flex items-start gap-2">
                    <span className="text-blue-500">🔒</span>
                    <span>
                      <strong>Password management:</strong> To change your password, please contact the system administrator.
                    </span>
                  </p>
                </div>
                <SecuritySettings
                  isOpen={showSecurity}
                  onClose={() => setShowSecurity(false)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}