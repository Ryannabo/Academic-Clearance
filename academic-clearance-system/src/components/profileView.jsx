// src/components/ProfileView.jsx
import React, { useState, useEffect } from 'react';
import { X, User, Mail, Book, Calendar, Edit2, Save, Camera, School, Hash } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function ProfileView({ isOpen, onClose }) {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchProfileData();
    }
  }, [isOpen, user]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      // Fetch user document
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfileData(userData);
        setEditedData(userData);
        
        // If student, also fetch student-specific data
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
      // Update user document
      await updateDoc(doc(db, 'users', user.uid), {
        name: editedData.name,
        email: editedData.email,
        updatedAt: new Date().toISOString()
      });

      // If student, update student document
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full">
              <User size={48} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">My Profile</h2>
              <p className="text-blue-100 text-sm">
                {profileData?.role === 'student' ? 'Student Account' :
                 profileData?.role === 'admin' ? 'Administrator Account' :
                 'Department Account'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading profile...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Basic Information</h3>
                  {!editing ? (
                    <button
                      onClick={handleEdit}
                      className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      <Edit2 size={16} />
                      Edit Profile
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Save size={16} />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <User size={16} />
                      Full Name
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={editedData.name || ''}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="px-4 py-2 bg-gray-50 rounded-lg">{profileData?.name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Mail size={16} />
                      Email Address
                    </label>
                    <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-500">
                      {profileData?.email}
                      <span className="ml-2 text-xs">(Cannot be changed)</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Student-specific Information */}
              {profileData?.role === 'student' && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Academic Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Student ID */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <Hash size={16} />
                        Student ID
                      </label>
                      <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-500">
                        {profileData?.studentId}
                        <span className="ml-2 text-xs">(Cannot be changed)</span>
                      </p>
                    </div>

                    {/* Course */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <Book size={16} />
                        Course/Program
                      </label>
                      {editing ? (
                        <select
                          value={editedData.course || ''}
                          onChange={(e) => handleChange('course', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Course</option>
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
                        <p className="px-4 py-2 bg-gray-50 rounded-lg">{profileData?.course}</p>
                      )}
                    </div>

                    {/* Year Level */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <School size={16} />
                        Year Level
                      </label>
                      {editing ? (
                        <select
                          value={editedData.yearLevel || ''}
                          onChange={(e) => handleChange('yearLevel', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Year</option>
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                          <option value="5th Year">5th Year</option>
                        </select>
                      ) : (
                        <p className="px-4 py-2 bg-gray-50 rounded-lg">{profileData?.yearLevel}</p>
                      )}
                    </div>

                    {/* Semester */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <Calendar size={16} />
                        Semester
                      </label>
                      {editing ? (
                        <select
                          value={editedData.semester || ''}
                          onChange={(e) => handleChange('semester', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Semester</option>
                          <option value="1st Semester">1st Semester</option>
                          <option value="2nd Semester">2nd Semester</option>
                          <option value="Summer">Summer</option>
                        </select>
                      ) : (
                        <p className="px-4 py-2 bg-gray-50 rounded-lg">{profileData?.semester}</p>
                      )}
                    </div>

                    {/* Section */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <User size={16} />
                        Section
                      </label>
                      {editing ? (
                        <select
                          value={editedData.section || ''}
                          onChange={(e) => handleChange('section', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Section</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="E">E</option>
                        </select>
                      ) : (
                        <p className="px-4 py-2 bg-gray-50 rounded-lg">{profileData?.section}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Department Information */}
              {profileData?.role !== 'student' && profileData?.role !== 'admin' && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Department Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <User size={16} />
                        Department
                      </label>
                      <p className="px-4 py-2 bg-gray-50 rounded-lg capitalize">
                        {profileData?.department?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <User size={16} />
                        Role
                      </label>
                      <p className="px-4 py-2 bg-gray-50 rounded-lg capitalize">
                        {profileData?.role?.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Information */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">Account Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2">Account Created</label>
                    <p className="px-4 py-2 bg-gray-50 rounded-lg text-sm">
                      {profileData?.createdAt 
                        ? new Date(profileData.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'N/A'}
                    </p>
                  </div>

                  {profileData?.updatedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2">Last Updated</label>
                      <p className="px-4 py-2 bg-gray-50 rounded-lg text-sm">
                        {new Date(profileData.updatedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Security Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Security</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    🔒 <strong>Password Management:</strong> To change your password, please contact the system administrator.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}