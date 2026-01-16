// src/components/DepartmentDashboard.jsx (Enhanced with Search & Filter)
import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, User, Bell, Eye, X, FileText, Download, Search, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

const departments = [
  { id: 'library', name: 'Library' },
  { id: 'course_office', name: 'Course Office' },
  { id: 'guidance', name: 'Guidance' },
  { id: 'student_council', name: 'Student Council' },
  { id: 'finance', name: 'Finance' },
  { id: 'student_government', name: 'Student Government' },
  { id: 'cashier', name: 'Cashier' }
];

export default function DepartmentDashboard() {
  const { user, logout } = useAuth();
  const [requirements, setRequirements] = useState([]);
  const [filteredRequirements, setFilteredRequirements] = useState([]);
  const [studentsData, setStudentsData] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  
  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [availableCourses, setAvailableCourses] = useState([]);

  const departmentName = departments.find(d => d.id === user?.role)?.name || user?.department;

  useEffect(() => {
    if (!user) return;

    const departmentId = user.role !== 'student' ? user.role : user.department;

    const requirementsQuery = query(
      collection(db, 'clearance_requirements'),
      where('department', '==', departmentId)
    );

    const unsubscribe = onSnapshot(requirementsQuery, async (snapshot) => {
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

      const studentIds = [...new Set(reqs.map(r => r.studentId))];
      const studentDataPromises = studentIds.map(async (id) => {
        try {
          const studentDoc = await getDoc(doc(db, 'students', id));
          if (studentDoc.exists()) {
            return { id, data: studentDoc.data() };
          }
          return { id, data: null };
        } catch (error) {
          console.error('Error fetching student:', error);
          return { id, data: null };
        }
      });

      const studentsArray = await Promise.all(studentDataPromises);
      const studentsMap = {};
      const courses = new Set();
      
      studentsArray.forEach(({ id, data }) => {
        if (data) {
          studentsMap[id] = data;
          if (data.course) courses.add(data.course);
        }
      });

      setStudentsData(studentsMap);
      setAvailableCourses(Array.from(courses));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Apply search and filters
  useEffect(() => {
    let filtered = requirements;

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(req => {
        const student = studentsData[req.studentId];
        if (!student) return false;
        
        const searchLower = searchTerm.toLowerCase();
        return (
          student.name?.toLowerCase().includes(searchLower) ||
          student.studentId?.toLowerCase().includes(searchLower) ||
          student.course?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(req => req.status === filterStatus);
    }

    // Apply course filter
    if (filterCourse !== 'all') {
      filtered = filtered.filter(req => {
        const student = studentsData[req.studentId];
        return student?.course === filterCourse;
      });
    }

    setFilteredRequirements(filtered);
  }, [searchTerm, filterStatus, filterCourse, requirements, studentsData]);

  const approveStudent = async (requirementId) => {
    try {
      const requirementRef = doc(db, 'clearance_requirements', requirementId);
      await updateDoc(requirementRef, {
        status: 'approved',
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
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

  const rejectStudent = async (requirementId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    const missing = prompt('What requirements are missing? (optional)');

    try {
      const requirementRef = doc(db, 'clearance_requirements', requirementId);
      await updateDoc(requirementRef, {
        status: 'rejected',
        rejectionReason: reason,
        missingRequirements: missing || null,
        rejectedBy: user.uid,
        rejectedAt: serverTimestamp()
      });
      alert('Clearance rejected. Student will be notified.');
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error rejecting student:', error);
      alert('Failed to reject. Please try again.');
    }
  };

  const viewStudent = (requirement) => {
    const studentInfo = studentsData[requirement.studentId];
    setSelectedStudent({
      ...requirement,
      studentInfo
    });
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
                <p className="text-gray-600 text-sm">Pending Review</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 appearance-none"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                <option value="all">All Courses</option>
                {availableCourses.map(course => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredRequirements.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchTerm || filterStatus !== 'all' || filterCourse !== 'all' 
                  ? 'No results found matching your filters' 
                  : 'No clearance requests yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Files</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRequirements.map(req => {
                    const student = studentsData[req.studentId];
                    return (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{student?.name || 'Loading...'}</div>
                          <div className="text-sm text-gray-500">{student?.yearLevel || ''}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student?.studentId || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student?.course || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {req.files?.length || 0} files
                        </td>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => viewStudent(req)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Eye size={18} className="inline mr-1" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Student Details Modal */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold">{selectedStudent.studentInfo?.name || 'Student'}</h3>
                  <p className="text-gray-600">{selectedStudent.studentInfo?.studentId || 'N/A'}</p>
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
                    <p className="font-medium">{selectedStudent.studentInfo?.course || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Year Level</p>
                    <p className="font-medium">{selectedStudent.studentInfo?.yearLevel || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-sm">{selectedStudent.studentInfo?.email || 'N/A'}</p>
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
                    Approved on {selectedStudent.approvedAt ? 
                      new Date(selectedStudent.approvedAt.seconds * 1000).toLocaleDateString() : 
                      'N/A'}
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