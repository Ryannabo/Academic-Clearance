// src/components/StudentDashboard.jsx (Enhanced with Requirements Display)
import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, Clock, Download, Bell, User, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const departments = [
  { id: 'library', name: 'Library', icon: '📚' },
  { id: 'course_office', name: 'Course Office', icon: '🎓' },
  { id: 'guidance', name: 'Guidance', icon: '🧭' },
  { id: 'student_council', name: 'Student Council', icon: '👥' },
  { id: 'finance', name: 'Finance', icon: '💰' },
  { id: 'student_government', name: 'Student Government', icon: '🏛️' },
  { id: 'cashier', name: 'Cashier', icon: '💳' }
];

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [requirements, setRequirements] = useState([]);
  const [requirementTemplates, setRequirementTemplates] = useState({});
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});
  const [selectedDept, setSelectedDept] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchStudentData = async () => {
      try {
        const studentDoc = await getDocs(
          query(collection(db, 'students'), where('__name__', '==', user.uid))
        );
        
        if (!studentDoc.empty) {
          setStudentData({ id: studentDoc.docs[0].id, ...studentDoc.docs[0].data() });
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
      }
    };

    fetchStudentData();

    // Subscribe to requirements templates
    const templatesQuery = query(collection(db, 'requirements_templates'));
    const unsubscribeTemplates = onSnapshot(templatesQuery, (snapshot) => {
      const templates = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!templates[data.department]) {
          templates[data.department] = [];
        }
        templates[data.department].push({ id: doc.id, ...data });
      });
      setRequirementTemplates(templates);
    });

    // Subscribe to clearance requirements
    const requirementsQuery = query(
      collection(db, 'clearance_requirements'),
      where('studentId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(requirementsQuery, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequirements(reqs);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeTemplates();
    };
  }, [user]);

  useEffect(() => {
    const initializeClearance = async () => {
      if (!user || requirements.length > 0) return;

      try {
        const clearanceQuery = query(
          collection(db, 'clearances'),
          where('studentId', '==', user.uid)
        );
        const clearanceSnapshot = await getDocs(clearanceQuery);

        if (clearanceSnapshot.empty) {
          const clearanceRef = await addDoc(collection(db, 'clearances'), {
            studentId: user.uid,
            studentName: user.name,
            status: 'pending',
            createdAt: serverTimestamp()
          });

          const requirementPromises = departments.map(dept =>
            addDoc(collection(db, 'clearance_requirements'), {
              clearanceId: clearanceRef.id,
              studentId: user.uid,
              department: dept.id,
              status: 'pending',
              files: [],
              createdAt: serverTimestamp()
            })
          );

          await Promise.all(requirementPromises);
        }
      } catch (error) {
        console.error('Error initializing clearance:', error);
      }
    };

    initializeClearance();
  }, [user, requirements]);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (deptId, event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const maxSize = 1 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      alert(`Some files are too large. Maximum size is 1MB per file.\nOversized files: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    setUploading(prev => ({ ...prev, [deptId]: true }));

    try {
      const requirement = requirements.find(r => r.department === deptId);
      if (!requirement) {
        alert('Requirement not found');
        return;
      }

      const uploadPromises = files.map(async (file) => {
        const base64 = await fileToBase64(file);
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64,
          uploadedAt: new Date().toISOString()
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      // Reset status to pending if reuploading
      const requirementRef = doc(db, 'clearance_requirements', requirement.id);
      await updateDoc(requirementRef, {
        files: [...(requirement.files || []), ...uploadedFiles],
        status: 'pending', // Reset to pending when new files uploaded
        updatedAt: serverTimestamp()
      });

      alert('Files uploaded successfully! Status reset to pending for review.');
      event.target.value = '';
      setSelectedDept(null);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
    } finally {
      setUploading(prev => ({ ...prev, [deptId]: false }));
    }
  };

  const exportToPDF = () => {
    if (!studentData) return;

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ACADEMIC CLEARANCE', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Student Name: ${studentData.name || user.name}`, 20, 40);
    doc.text(`Student ID: ${studentData.studentId || 'N/A'}`, 20, 50);
    doc.text(`Course: ${studentData.course || 'N/A'}`, 20, 60);
    doc.text(`Year Level: ${studentData.yearLevel || 'N/A'}`, 20, 70);
    
    const tableData = requirements.map(req => {
      const dept = departments.find(d => d.id === req.department);
      return [
        dept?.name || req.department,
        req.status?.toUpperCase() || 'PENDING',
        req.files?.length || 0,
        req.approvedAt ? new Date(req.approvedAt.seconds * 1000).toLocaleDateString() : 'N/A'
      ];
    });
    
    doc.autoTable({
      startY: 85,
      head: [['Department', 'Status', 'Files', 'Date Approved']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [63, 81, 181] },
      styles: { fontSize: 10 }
    });
    
    const finalY = doc.lastAutoTable.finalY || 85;
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, finalY + 20);
    
    const allApproved = requirements.every(r => r.status === 'approved');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    if (allApproved) {
      doc.setTextColor(0, 128, 0);
      doc.text('STATUS: CLEARED ✓', 105, finalY + 35, { align: 'center' });
    } else {
      doc.setTextColor(255, 140, 0);
      doc.text('STATUS: PENDING', 105, finalY + 35, { align: 'center' });
    }
    
    doc.save(`Clearance_${studentData.studentId}_${Date.now()}.pdf`);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'rejected':
        return <XCircle className="text-red-600" size={20} />;
      default:
        return <Clock className="text-amber-600" size={20} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending Review';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'text-green-600';
      case 'rejected':
        return 'text-red-600';
      default:
        return 'text-amber-600';
    }
  };

  const approvedCount = requirements.filter(r => r.status === 'approved').length;
  const progress = requirements.length > 0 ? (approvedCount / requirements.length) * 100 : 0;

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
          <h1 className="text-2xl font-bold text-indigo-600">Clearance System</h1>
          <div className="flex items-center gap-4">
            <Bell className="text-gray-600 cursor-pointer" />
            <div className="flex items-center gap-2">
              <User size={20} />
              <span className="font-medium">{user?.name}</span>
            </div>
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
        <div className="bg-white rounded-lg shadow-sm mb-6 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}</h2>
              <p className="text-gray-600">Student ID: {studentData?.studentId || 'N/A'}</p>
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Overall Progress:</span>
                  <span className="text-sm text-indigo-600 font-bold">
                    {approvedCount}/{requirements.length} Completed
                  </span>
                </div>
                <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              <Download size={20} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
              activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
              activeTab === 'requirements' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Upload Requirements
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold mb-4">Clearance Status by Department</h3>
            <div className="space-y-3">
              {departments.map(dept => {
                const req = requirements.find(r => r.department === dept.id);
                return (
                  <div key={dept.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{dept.icon}</span>
                        <div>
                          <p className="font-semibold">{dept.name}</p>
                          <p className="text-sm text-gray-500">
                            {req?.files?.length || 0} file{(req?.files?.length || 0) !== 1 ? 's' : ''} uploaded
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 font-medium ${getStatusColor(req?.status)}`}>
                          {getStatusIcon(req?.status)}
                          {getStatusText(req?.status)}
                        </span>
                      </div>
                    </div>
                    
                    {req?.status === 'rejected' && req?.rejectionReason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                          <div>
                            <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
                            <p className="text-sm text-red-700 mt-1">{req.rejectionReason}</p>
                            {req.missingRequirements && (
                              <p className="text-sm text-red-700 mt-1">
                                <strong>Missing:</strong> {req.missingRequirements}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'requirements' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map(dept => {
              const req = requirements.find(r => r.department === dept.id);
              const isUploading = uploading[dept.id];
              const deptRequirements = requirementTemplates[dept.id] || [];
              
              return (
                <div key={dept.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{dept.icon}</span>
                    <h3 className="font-bold text-lg">{dept.name}</h3>
                  </div>

                  {/* Display Department Requirements */}
                  {deptRequirements.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-semibold text-blue-900 mb-2">Required Documents:</p>
                      <ul className="space-y-1">
                        {deptRequirements.map(template => (
                          <li key={template.id} className="text-xs text-blue-800">
                            <span className={template.required ? 'font-semibold' : ''}>
                              {template.required && '• '}
                              {template.title}
                            </span>
                            {template.description && (
                              <p className="text-xs text-blue-600 ml-2">{template.description}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="block">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors">
                        <Upload className="mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          {isUploading ? 'Uploading...' : 'Click to upload files'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG (max 1MB each)</p>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => handleFileUpload(dept.id, e)}
                          disabled={isUploading}
                        />
                      </div>
                    </label>
                    {req?.files && req.files.length > 0 && (
                      <div className={`p-3 rounded-lg ${
                        req.status === 'approved' ? 'bg-green-50' :
                        req.status === 'rejected' ? 'bg-red-50' :
                        'bg-amber-50'
                      }`}>
                        <p className={`text-sm font-medium mb-2 ${
                          req.status === 'approved' ? 'text-green-700' :
                          req.status === 'rejected' ? 'text-red-700' :
                          'text-amber-700'
                        }`}>
                          {getStatusIcon(req.status)}
                          <span className="ml-1">
                            {req.status === 'approved' ? '✓ Approved' :
                             req.status === 'rejected' ? '✗ Rejected' :
                             '⏳ Under Review'}
                          </span>
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {req.files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <p className="text-xs text-gray-600 truncate flex-1">
                                {file.name}
                              </p>
                              <span className="text-xs text-gray-400 ml-2">
                                {(file.size / 1024).toFixed(1)}KB
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}