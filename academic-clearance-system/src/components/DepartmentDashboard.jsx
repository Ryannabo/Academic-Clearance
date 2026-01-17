// src/components/DepartmentDashboard.jsx (Restructured Database)
import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, User, Bell, Eye, X, FileText, Download, Search, Filter, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  query, 
  onSnapshot,
  updateDoc,
  doc,
  getDocs
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
  
  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterYearLevel, setFilterYearLevel] = useState('all');
  const [filterSemester, setFilterSemester] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [availableCourses, setAvailableCourses] = useState([]);
  const [availableYearLevels, setAvailableYearLevels] = useState([]);
  const [availableSemesters, setAvailableSemesters] = useState([]);

  // Get department ID from user
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

    // Subscribe to THIS department's students subcollection only
    const studentsCollectionRef = collection(db, 'clearance_requirements', departmentId, 'students');
    
    const unsubscribe = onSnapshot(studentsCollectionRef, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setRequirements(reqs);
      setFilteredRequirements(reqs);

      const newStats = {
        total: reqs.length,
        pending: reqs.filter(r => r.status === 'pending').length,
        approved: reqs.filter(r => r.status === 'approved').length,
        rejected: reqs.filter(r => r.status === 'rejected').length
      };
      setStats(newStats);

      // Extract unique values for filters
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

  // Apply search and filters
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

    if (dateTo) {
      filtered = filtered.filter(req => {
        if (!req.createdAt) return false;
        const createdDate = new Date(req.createdAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        return createdDate <= toDate;
      });
    }

    setFilteredRequirements(filtered);
  }, [searchTerm, filterStatus, filterCourse, filterYearLevel, filterSemester, dateFrom, dateTo, requirements]);

  const approveStudent = async (studentId) => {
    try {
      const reqDocRef = doc(db, 'clearance_requirements', departmentId, 'students', studentId);
      await updateDoc(reqDocRef, {
        status: 'approved',
        approvedBy: user.uid,
        approvedAt: new Date().toISOString(),
        rejectionReason: null,
        missingRequirements: null
      });
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
      alert('Clearance rejected. Student will be notified.');
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error rejecting student:', error);
      alert('Failed to reject. Please try again.');
    }
  };

  const viewStudent = (requirement) => {
    setSelectedStudent(requirement);
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    link.click();
  };

  const previewFileHandler = (file) => {
    setPreviewFile(file);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600">{departmentName} Dashboard</h1>
            <p className="text-sm text-gray-600">Clearance Management</p>
          </div>
          <div className="flex items-center gap-4">
            <Bell className="text-gray-600 cursor-pointer" />
            <User size={20} />
            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Students</p>
                <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <User className="text-indigo-600" size={40} />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <Clock className="text-amber-600" size={40} />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Approved</p>
                <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle className="text-green-600" size={40} />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Rejected</p>
                <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <X className="text-red-600" size={40} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-bold mb-6">Student Clearance Requests</h2>
          
          {/* Search and Filter Section */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by name, ID, or course..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Courses</option>
                  {availableCourses.map(course => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterYearLevel}
                  onChange={(e) => setFilterYearLevel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Year Levels</option>
                  {availableYearLevels.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterSemester}
                  onChange={(e) => setFilterSemester(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Semesters</option>
                  {availableSemesters.map(sem => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="From date"
                />
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="To date"
                />
              </div>
            </div>

            {(searchTerm || filterStatus !== 'all' || filterCourse !== 'all' || filterYearLevel !== 'all' || filterSemester !== 'all' || dateFrom || dateTo) && (
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Showing {filteredRequirements.length} of {requirements.length} results
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('all');
                    setFilterCourse('all');
                    setFilterYearLevel('all');
                    setFilterSemester('all');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {filteredRequirements.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {requirements.length === 0 
                  ? 'No clearance requests yet' 
                  : 'No results found matching your filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year/Sem</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Files</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRequirements.map(req => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{req.studentName || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{req.studentIdNumber || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{req.course || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <div>{req.yearLevel}</div>
                        <div className="text-gray-500">{req.semester}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(req.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{req.files?.length || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          req.status === 'approved' 
                            ? 'bg-green-100 text-green-800' 
                            : req.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {req.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => viewStudent(req)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Eye size={18} className="inline mr-1" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Student Details Modal (same as before, just using req.id as studentId) */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold">{selectedStudent.studentName || 'Student'}</h3>
                  <p className="text-gray-600">{selectedStudent.studentIdNumber || 'N/A'}</p>
                </div>
                <button 
                  onClick={() => setSelectedStudent(null)} 
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Course</p>
                    <p className="font-medium">{selectedStudent.course || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Year Level</p>
                    <p className="font-medium">{selectedStudent.yearLevel || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Semester</p>
                    <p className="font-medium">{selectedStudent.semester || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-sm">{selectedStudent.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Submitted Date</p>
                    <p className="font-medium text-sm">{formatDate(selectedStudent.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className={`font-medium ${
                      selectedStudent.status === 'approved' ? 'text-green-600' : 
                      selectedStudent.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {selectedStudent.status?.toUpperCase() || 'PENDING'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-3">Uploaded Files ({selectedStudent.files?.length || 0})</p>
                  {selectedStudent.files && selectedStudent.files.length > 0 ? (
                    <div className="space-y-2">
                      {selectedStudent.files.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center gap-2 flex-1">
                            <FileText size={16} className="text-gray-500" />
                            <div className="flex-1">
                              <span className="text-sm font-medium block">{file.name}</span>
                              <span className="text-xs text-gray-500">
                                {file.type} • {(file.size / 1024).toFixed(1)}KB
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => previewFileHandler(file)}
                              className="text-indigo-600 hover:text-indigo-700 text-sm px-3 py-1 border border-indigo-600 rounded"
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => downloadFile(file)}
                              className="text-green-600 hover:text-green-700 text-sm"
                            >
                              <Download size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg text-center">
                      No files uploaded yet
                    </p>
                  )}
                </div>

                {selectedStudent.status === 'rejected' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
                    <p className="text-sm text-red-700 mt-1">{selectedStudent.rejectionReason || 'N/A'}</p>
                    {selectedStudent.missingRequirements && (
                      <>
                        <p className="text-sm font-medium text-red-800 mt-2">Missing Requirements:</p>
                        <p className="text-sm text-red-700 mt-1">{selectedStudent.missingRequirements}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {selectedStudent.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => approveStudent(selectedStudent.id)}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
                  >
                    Approve Clearance
                  </button>
                  <button
                    onClick={() => rejectStudent(selectedStudent.id)}
                    className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}

              {selectedStudent.status === 'approved' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle className="mx-auto mb-2 text-green-600" size={32} />
                  <p className="text-green-800 font-medium">Already Approved</p>
                  <p className="text-sm text-green-700 mt-1">
                    Approved on {formatDate(selectedStudent.approvedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* File Preview Modal */}
        {previewFile && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{previewFile.name}</h3>
                <button 
                  onClick={() => setPreviewFile(null)} 
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex justify-center">
                {previewFile.type.startsWith('image/') ? (
                  <img 
                    src={previewFile.data} 
                    alt={previewFile.name}
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : previewFile.type === 'application/pdf' ? (
                  <iframe
                    src={previewFile.data}
                    className="w-full h-[70vh] border rounded-lg"
                    title={previewFile.name}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">Preview not available for this file type</p>
                    <button
                      onClick={() => downloadFile(previewFile)}
                      className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
                    >
                      Download File
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}