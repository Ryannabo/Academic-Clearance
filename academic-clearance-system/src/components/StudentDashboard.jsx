// src/components/StudentDashboard.jsx (Final Version)
import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, Clock, Download, Bell, User, XCircle, AlertCircle, FileText } from 'lucide-react';
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
          // Create new clearance
          const clearanceRef = await addDoc(collection(db, 'clearances'), {
            studentId: user.uid,
            studentName: user.name,
            status: 'pending',
            createdAt: serverTimestamp()
          });

          // Check which departments already have requirements
          const existingReqsQuery = query(
            collection(db, 'clearance_requirements'),
            where('studentId', '==', user.uid)
          );
          const existingReqsSnapshot = await getDocs(existingReqsQuery);
          const existingDepartments = existingReqsSnapshot.docs.map(doc => doc.data().department);

          // Only create requirements for departments that don't exist
          const missingDepartments = departments.filter(dept => !existingDepartments.includes(dept.id));
          
          const requirementPromises = missingDepartments.map(dept =>
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

      const requirementRef = doc(db, 'clearance_requirements', requirement.id);
      await updateDoc(requirementRef, {
        files: [...(requirement.files || []), ...uploadedFiles],
        status: 'pending',
        updatedAt: serverTimestamp()
      });

      alert('Files uploaded successfully! Status reset to pending for review.');
      event.target.value = '';
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
    doc.text(`Semester: ${studentData.semester || 'N/A'}`, 20, 80);
    
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
      startY: 95,
      head: [['Department', 'Status', 'Files', 'Date Approved']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [63, 81, 181] },
      styles: { fontSize: 10 }
    });
    
    const finalY = doc.lastAutoTable.finalY || 95;
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
              <p className="text-sm text-gray-500">
                {studentData?.course} - {studentData?.yearLevel} - {studentData?.semester}
              </p>
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
            onClick={() => setActiveTab('all-requirements')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
              activeTab === 'all-requirements' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            <FileText size={18} className="inline mr-1" />
            All Requirements
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
              activeTab === 'upload' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            Upload Files
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

        {activeTab === 'all-requirements' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold mb-4">Department Requirements</h3>
            <p className="text-sm text-gray-600 mb-6">
              Below are all the requirements you need to submit for each department to get your clearance approved.
            </p>
            
            <div className="space-y-6">
              {departments.map(dept => {
                const deptRequirements = requirementTemplates[dept.id] || [];
                const req = requirements.find(r => r.department === dept.id);
                
                return (
                  <div key={dept.id} className="border rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{dept.icon}</span>
                        <div>
                          <h4 className="font-bold text-lg">{dept.name}</h4>
                          <span className={`text-sm ${getStatusColor(req?.status)}`}>
                            {getStatusText(req?.status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {deptRequirements.length === 0 ? (
                      <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded">
                        No specific requirements set for this department yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {deptRequirements.map((template, idx) => (
                          <div key={template.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <span className="font-bold text-blue-900">{idx + 1}.</span>
                              <div className="flex-1">
                                <p className="font-semibold text-blue-900">
                                  {template.title}
                                  {template.required && (
                                    <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                      Required
                                    </span>
                                  )}
                                </p>
                                {template.description && (
                                  <p className="text-sm text-blue-800 mt-1">{template.description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map(dept => {
              const req = requirements.find(r => r.department === dept.id);
              const isUploading = uploading[dept.id];
              
              return (
                <div key={dept.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{dept.icon}</span>
                    <h3 className="font-bold text-lg">{dept.name}</h3>
                  </div>

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
                        req.status === 'approved' ? 'bg-green-50 border border-green-200' :
                        req.status === 'rejected' ? 'bg-red-50 border border-red-200' :
                        'bg-amber-50 border border-amber-200'
                      }`}>
                        <p className={`text-sm font-medium mb-2 flex items-center gap-1 ${
                          req.status === 'approved' ? 'text-green-700' :
                          req.status === 'rejected' ? 'text-red-700' :
                          'text-amber-700'
                        }`}>
                          {getStatusIcon(req.status)}
                          <span className="ml-1">{getStatusText(req.status)}</span>
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {req.files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <p className="text-gray-600 truncate flex-1">{file.name}</p>
                              <span className="text-gray-400 ml-2">{(file.size / 1024).toFixed(1)}KB</span>
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