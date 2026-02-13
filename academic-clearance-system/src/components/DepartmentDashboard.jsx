// src/components/DepartmentDashboard.jsx – FULLY RESPONSIVE (LOGIC UNCHANGED)
import React, { useState, useEffect } from 'react';
import {
  CheckCircle, Clock, User, Bell, Eye, X, FileText, Download,
  Search, Filter, Calendar, CheckSquare, Square, Trash2, XCircle, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationPanel from './NotificationPanel';
import { notifyStudentStatusChange } from '../utils/notifications';
import DarkModeToggle from './DarkModeToggle';
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
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

export default function DepartmentDashboard() {
  const { user, logout } = useAuth();
  const [requirements, setRequirements] = useState([]);
  const [filteredRequirements, setFilteredRequirements] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // Bulk action states
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterYearLevel, setFilterYearLevel] = useState('all');
  const [filterSemester, setFilterSemester] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [availableCourses, setAvailableCourses] = useState([]);
  const [availableYearLevels, setAvailableYearLevels] = useState([]);
  const [availableSemesters, setAvailableSemesters] = useState([]);

  const getDepartmentId = () => {
    if (user.department) {
      return user.department;
    } else if (user.role?.startsWith('dept_')) {
      return user.role.replace('dept_', '');
    }
    return null;
  };

  const departmentId = getDepartmentId();
  const departmentName = departments.find(d => d.id === departmentId)?.name || 'Department';

  useEffect(() => {
    if (!user || !departmentId) return;

    const studentsCollectionRef = collection(db, 'clearance_requirements', departmentId, 'students');

    const unsubscribe = onSnapshot(studentsCollectionRef, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setRequirements(reqs);

      const newStats = {
        total: reqs.length,
        pending: reqs.filter(r => r.status === 'pending').length,
        approved: reqs.filter(r => r.status === 'approved').length,
        rejected: reqs.filter(r => r.status === 'rejected').length
      };
      setStats(newStats);

      const courses = new Set();
      const yearLevels = new Set();
      const semesters = new Set();

      reqs.forEach(req => {
        if (req.course) courses.add(req.course);
        if (req.yearLevel) yearLevels.add(req.yearLevel);
        if (req.semester) semesters.add(req.semester);
      });

      setAvailableCourses(Array.from(courses).sort());
      setAvailableYearLevels(Array.from(yearLevels).sort());
      setAvailableSemesters(Array.from(semesters).sort());
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, departmentId]);

  useEffect(() => {
    let filtered = requirements;

    if (searchTerm) {
      filtered = filtered.filter(req => {
        const searchLower = searchTerm.toLowerCase();
        return (
          req.studentName?.toLowerCase().includes(searchLower) ||
          req.studentIdNumber?.toLowerCase().includes(searchLower) ||
          req.course?.toLowerCase().includes(searchLower)
        );
      });
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(req => req.status === filterStatus);
    }

    if (filterCourse !== 'all') {
      filtered = filtered.filter(req => req.course === filterCourse);
    }

    if (filterYearLevel !== 'all') {
      filtered = filtered.filter(req => req.yearLevel === filterYearLevel);
    }

    if (filterSemester !== 'all') {
      filtered = filtered.filter(req => req.semester === filterSemester);
    }

    if (dateFrom) {
      filtered = filtered.filter(req => {
        if (!req.createdAt) return false;
        const createdDate = new Date(req.createdAt);
        return createdDate >= new Date(dateFrom);
      });
    }

    setFilteredRequirements(filtered);
  }, [searchTerm, filterStatus, filterCourse, filterYearLevel, filterSemester, dateFrom, requirements]);

  // Bulk Actions
  const toggleSelectAll = () => {
    if (selectedItems.size === filteredRequirements.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredRequirements.map(req => req.id)));
    }
  };

  const toggleSelectItem = (id) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const bulkApprove = async () => {
    if (selectedItems.size === 0) {
      alert('Please select at least one student');
      return;
    }

    if (!confirm(`Approve ${selectedItems.size} selected student(s)?`)) return;

    setBulkProcessing(true);
    try {
      const batch = writeBatch(db);
      let successCount = 0;

      selectedItems.forEach(studentId => {
        const reqDocRef = doc(db, 'clearance_requirements', departmentId, 'students', studentId);
        batch.update(reqDocRef, {
          status: 'approved',
          approvedBy: user.uid,
          approvedAt: new Date().toISOString(),
          rejectionReason: null,
          missingRequirements: null
        });
        successCount++;
        notifyStudentStatusChange(studentId, departmentId, 'approved');
      });

      await batch.commit();
      alert(`✅ Successfully approved ${successCount} student(s)!`);
      setSelectedItems(new Set());
      setBulkActionMode(false);
    } catch (error) {
      console.error('Error bulk approving:', error);
      alert('❌ Failed to approve students: ' + error.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const bulkReject = async () => {
    if (selectedItems.size === 0) {
      alert('Please select at least one student');
      return;
    }

    const reason = prompt('Enter rejection reason for all selected students:');
    if (!reason) return;

    const missing = prompt('What requirements are missing? (optional)');

    setBulkProcessing(true);
    try {
      const batch = writeBatch(db);
      let successCount = 0;

      selectedItems.forEach(studentId => {
        const reqDocRef = doc(db, 'clearance_requirements', departmentId, 'students', studentId);
        batch.update(reqDocRef, {
          status: 'rejected',
          rejectionReason: reason,
          missingRequirements: missing || null,
          rejectedBy: user.uid,
          rejectedAt: new Date().toISOString()
        });
        successCount++;

        const fullReason = missing ? `${reason}. Missing: ${missing}` : reason;
        notifyStudentStatusChange(studentId, departmentId, 'rejected', fullReason);
      });

      await batch.commit();
      alert(`✅ Successfully rejected ${successCount} student(s)!`);
      setSelectedItems(new Set());
      setBulkActionMode(false);
    } catch (error) {
      console.error('Error bulk rejecting:', error);
      alert('❌ Failed to reject students: ' + error.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const approveStudent = async (studentId) => {
    try {
      const reqDocRef = doc(db, 'clearance_requirements', departmentId, 'students', studentId);
      await updateDoc(reqDocRef, {
        status: 'approved',
        approvedByName: user.name,
        approvedBy: user.name,
        approvedByEmail: user.email,
        approvedAt: new Date().toISOString()
      });

      await notifyStudentStatusChange(studentId, departmentId, 'approved');
      alert('Student clearance approved successfully!');
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error approving student:', error);
      alert('Failed to approve. Please try again.');
    }
  };

  const rejectStudent = async (studentId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    const missing = prompt('What requirements are missing? (optional)');

    try {
      const reqDocRef = doc(db, 'clearance_requirements', departmentId, 'students', studentId);
      await updateDoc(reqDocRef, {
        status: 'rejected',
        rejectionReason: reason,
        missingRequirements: missing || null,
        rejectedBy: user.uid,
        rejectedAt: new Date().toISOString()
      });

      const fullReason = missing ? `${reason}. Missing: ${missing}` : reason;
      await notifyStudentStatusChange(studentId, departmentId, 'rejected', fullReason);

      alert('Clearance rejected. Student will be notified.');
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error rejecting student:', error);
      alert('Failed to reject. Please try again.');
    }
  };

  const viewStudent = (requirement) => {
    console.log('📂 Opening student details:', requirement);
    console.log('📎 Files:', requirement.files);
    setSelectedStudent(requirement);
  };

  const downloadFile = (file) => {
    console.log('⬇️ Downloading file:', file.name);
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    link.click();
  };

  const previewFileHandler = (file) => {
    console.log('👁️ Previewing file:', file);
    setPreviewFile(file);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // --------------------- FULLY RESPONSIVE UI (LOGIC UNCHANGED) ---------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 overflow-x-hidden">
      
      {/* ✅ RESPONSIVE NAVBAR */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          {/* Left – Title */}
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
              <CheckCircle className="text-indigo-600 dark:text-indigo-400" size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 truncate">
                {departmentName} Dashboard
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400 hidden sm:block">
                Clearance Management
              </p>
            </div>
          </div>

          {/* Right – User controls – tightly packed */}
          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <DarkModeToggle />
            <NotificationPanel />
            <div className="flex items-center gap-1 sm:gap-2">
              <User size={20} className="text-gray-600 dark:text-gray-400" />
              <button
                onClick={logout}
                className="bg-red-600 dark:bg-red-500 text-white px-2.5 py-1.5 rounded-lg text-xs sm:text-sm hover:bg-red-700 dark:hover:bg-red-600 transition-colors whitespace-nowrap"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* ✅ RESPONSIVE STATS CARDS */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Total Students</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.total}</p>
              </div>
              <User className="text-indigo-600 dark:text-indigo-400" size={32} />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
              </div>
              <Clock className="text-amber-600 dark:text-amber-400" size={32} />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Approved</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{stats.approved}</p>
              </div>
              <CheckCircle className="text-green-600 dark:text-green-400" size={32} />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Rejected</p>
                <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</p>
              </div>
              <X className="text-red-600 dark:text-red-400" size={32} />
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 transition-colors duration-300">
          
          {/* Header + Bulk Toggle */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
              Student Clearance Requests
            </h2>
            <button
              onClick={() => {
                setBulkActionMode(!bulkActionMode);
                setSelectedItems(new Set());
              }}
              className={`w-full sm:w-auto px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                bulkActionMode
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {bulkActionMode ? '✓ Bulk Mode Active' : 'Enable Bulk Actions'}
            </button>
          </div>

          {/* ✅ RESPONSIVE BULK ACTION BAR */}
          {bulkActionMode && (
            <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors duration-300">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-indigo-900 dark:text-indigo-300 text-sm sm:text-base">
                    {selectedItems.size} selected
                  </span>
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                  >
                    {selectedItems.size === filteredRequirements.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {selectedItems.size > 0 && (
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                      onClick={bulkApprove}
                      disabled={bulkProcessing}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                      <CheckCircle size={16} />
                      <span className="sm:hidden">Approve</span>
                      <span className="hidden sm:inline">Approve Selected</span>
                    </button>
                    <button
                      onClick={bulkReject}
                      disabled={bulkProcessing}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 text-sm font-medium transition-colors"
                    >
                      <XCircle size={16} />
                      <span className="sm:hidden">Reject</span>
                      <span className="hidden sm:inline">Reject Selected</span>
                    </button>
                  </div>
                )}
              </div>
              {bulkProcessing && (
                <div className="mt-3 flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-700 dark:border-indigo-400"></div>
                  <span className="text-sm">Processing...</span>
                </div>
              )}
            </div>
          )}

          {/* ✅ RESPONSIVE SEARCH & FILTERS */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                <input
                  type="text"
                  placeholder="Search name, ID, course..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors duration-300"
                />
              </div>
              {/* Status Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors duration-300"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              {/* Course Filter */}
              <div>
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors duration-300"
                >
                  <option value="all">All Courses</option>
                  {availableCourses.map(course => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>
              {/* Year Level Filter */}
              <div>
                <select
                  value={filterYearLevel}
                  onChange={(e) => setFilterYearLevel(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors duration-300"
                >
                  <option value="all">All Year Levels</option>
                  {availableYearLevels.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ✅ RESPONSIVE TABLE */}
          {filteredRequirements.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                {requirements.length === 0
                  ? 'No clearance requests yet'
                  : filterStatus === 'pending'
                    ? 'No pending requests at the moment'
                    : 'No results found matching your filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700 transition-colors duration-300">
                    <tr>
                      {bulkActionMode && (
                        <th className="px-3 sm:px-6 py-3 text-left">
                          <button onClick={toggleSelectAll} className="p-1">
                            {selectedItems.size === filteredRequirements.length ? (
                              <CheckSquare className="text-indigo-600 dark:text-indigo-400" size={20} />
                            ) : (
                              <Square className="text-gray-400 dark:text-gray-500" size={20} />
                            )}
                          </button>
                        </th>
                      )}
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">ID</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Course</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Year/Sem</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden xl:table-cell">Submitted</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Files</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRequirements.map(req => (
                      <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        {bulkActionMode && (
                          <td className="px-3 sm:px-6 py-4">
                            <button onClick={() => toggleSelectItem(req.id)} className="p-1">
                              {selectedItems.has(req.id) ? (
                                <CheckSquare className="text-indigo-600 dark:text-indigo-400" size={20} />
                              ) : (
                                <Square className="text-gray-400 dark:text-gray-500" size={20} />
                              )}
                            </button>
                          </td>
                        )}
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{req.studentName || 'N/A'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">{req.studentIdNumber || 'N/A'}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 hidden sm:table-cell">{req.studentIdNumber || 'N/A'}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 hidden md:table-cell">{req.course || 'N/A'}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs hidden lg:table-cell">
                          <div className="text-gray-900 dark:text-gray-100">{req.yearLevel}</div>
                          <div className="text-gray-500 dark:text-gray-400">{req.semester}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 hidden xl:table-cell">
                          {formatDate(req.createdAt)}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{req.files?.length || 0}</td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 sm:px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            req.status === 'approved'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : req.status === 'rejected'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'
                          }`}>
                            {req.status || 'pending'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => viewStudent(req)}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 inline-flex items-center gap-1"
                          >
                            <Eye size={18} />
                            <span className="hidden sm:inline">View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ RESPONSIVE STUDENT DETAILS MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-3 sm:p-4 z-50 transition-opacity duration-300 overflow-x-hidden">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-sm sm:max-w-2xl lg:max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 transition-colors duration-300 shadow-xl">
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 break-words">
                  {selectedStudent.studentName || 'Student'}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 break-words">
                  {selectedStudent.studentIdNumber || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 -mt-1 -mr-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* Student Info – responsive grid */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Course</p>
                  <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 break-words">{selectedStudent.course || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Year Level</p>
                  <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">{selectedStudent.yearLevel || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Semester</p>
                  <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">{selectedStudent.semester || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Section</p>
                  <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">{selectedStudent.section || 'N/A'}</p>
                </div>
                <div className="xs:col-span-2">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Email</p>
                  <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 break-words">{selectedStudent.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Submitted Date</p>
                  <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">{formatDate(selectedStudent.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Status</p>
                  <p className={`font-medium text-sm sm:text-base ${
                    selectedStudent.status === 'approved' ? 'text-green-600 dark:text-green-400' :
                    selectedStudent.status === 'rejected' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {selectedStudent.status?.toUpperCase() || 'PENDING'}
                  </p>
                </div>
              </div>

              {/* Files Section */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Uploaded Files ({selectedStudent.files?.length || 0})
                </p>
                {selectedStudent.files && selectedStudent.files.length > 0 ? (
                  <div className="space-y-2">
                    {selectedStudent.files.map((file, idx) => (
                      <div key={idx} className="flex flex-col xs:flex-row xs:items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText size={20} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs sm:text-sm font-medium block truncate text-gray-800 dark:text-gray-200">{file.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {file.type} • {(file.size / 1024).toFixed(1)}KB
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 self-end xs:self-center">
                          <button
                            onClick={() => previewFileHandler(file)}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-xs px-3 py-1.5 border border-indigo-600 dark:border-indigo-500 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center gap-1"
                          >
                            <Eye size={16} />
                            Preview
                          </button>
                          <button
                            onClick={() => downloadFile(file)}
                            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 p-1"
                            title="Download"
                          >
                            <Download size={20} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                    No files uploaded yet
                  </p>
                )}
              </div>

              {/* Rejection Info */}
              {selectedStudent.status === 'rejected' && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4 transition-colors duration-300">
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">Rejection Reason:</p>
                  <p className="text-xs sm:text-sm text-red-700 dark:text-red-400 mt-1 break-words">{selectedStudent.rejectionReason || 'N/A'}</p>
                  {selectedStudent.missingRequirements && (
                    <>
                      <p className="text-sm font-medium text-red-800 dark:text-red-400 mt-2">Missing Requirements:</p>
                      <p className="text-xs sm:text-sm text-red-700 dark:text-red-400 mt-1 break-words">{selectedStudent.missingRequirements}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons – responsive */}
            {selectedStudent.status === 'pending' && (
              <div className="flex flex-col xs:flex-row gap-3">
                <button
                  onClick={() => approveStudent(selectedStudent.id)}
                  className="flex-1 bg-green-600 dark:bg-green-500 text-white py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-green-700 dark:hover:bg-green-600 transition-colors text-sm sm:text-base"
                >
                  ✓ Approve Clearance
                </button>
                <button
                  onClick={() => rejectStudent(selectedStudent.id)}
                  className="flex-1 bg-red-600 dark:bg-red-500 text-white py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-sm sm:text-base"
                >
                  ✗ Reject
                </button>
              </div>
            )}

            {selectedStudent.status === 'approved' && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center transition-colors duration-300">
                <CheckCircle className="mx-auto mb-2 text-green-600 dark:text-green-400" size={32} />
                <p className="text-green-800 dark:text-green-400 font-medium text-sm sm:text-base">Already Approved</p>
                <p className="text-xs sm:text-sm text-green-700 dark:text-green-400 mt-1">
                  Approved on {formatDate(selectedStudent.approvedAt)}
                </p>
              </div>
            )}

            {selectedStudent.status === 'rejected' && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center transition-colors duration-300">
                <AlertCircle className="mx-auto mb-2 text-amber-600 dark:text-amber-400" size={32} />
                <p className="text-amber-800 dark:text-amber-400 font-medium text-sm sm:text-base">Currently Rejected</p>
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 mt-1">
                  Student can resubmit with correct requirements
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✅ RESPONSIVE FILE PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-90 dark:bg-opacity-95 flex items-center justify-center p-2 sm:p-4 z-[60] transition-opacity duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-full sm:max-w-4xl lg:max-w-6xl w-full max-h-[98vh] sm:max-h-[95vh] overflow-hidden flex flex-col transition-colors duration-300 shadow-2xl">
            {/* Header */}
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" size={24} />
                <div className="min-w-0">
                  <h3 className="font-bold text-base sm:text-lg text-gray-800 dark:text-gray-100 truncate">{previewFile.name}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    {previewFile.type} • {(previewFile.size / 1024).toFixed(1)}KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end xs:self-center">
                <button
                  onClick={() => downloadFile(previewFile)}
                  className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors text-xs sm:text-sm"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Download</span>
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-2 sm:p-4 bg-gray-100 dark:bg-gray-900">
              <div className="flex justify-center items-center min-h-full">
                {previewFile.type.startsWith('image/') ? (
                  <img
                    src={previewFile.data}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    style={{ maxHeight: 'calc(98vh - 120px)' }}
                  />
                ) : previewFile.type === 'application/pdf' ? (
                  <iframe
                    src={previewFile.data}
                    className="w-full rounded-lg shadow-2xl bg-white dark:bg-gray-800"
                    style={{ height: 'calc(98vh - 120px)' }}
                    title={previewFile.name}
                  />
                ) : (
                  <div className="text-center py-8 sm:py-12 bg-white dark:bg-gray-800 rounded-lg p-6 sm:p-8 shadow-lg transition-colors duration-300 max-w-sm sm:max-w-md mx-auto">
                    <FileText size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2 text-base sm:text-lg">Preview not available</p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500 mb-6 break-words">{previewFile.type}</p>
                    <button
                      onClick={() => downloadFile(previewFile)}
                      className="bg-indigo-600 dark:bg-indigo-500 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 inline-flex items-center gap-2 transition-colors text-sm sm:text-base"
                    >
                      <Download size={18} />
                      Download File
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}