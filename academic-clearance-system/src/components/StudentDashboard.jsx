// src/components/StudentDashboard.jsx (WITH DARK MODE)
import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, Clock, Download, Bell, User, XCircle, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationPanel from './NotificationPanel';
import { createNotification, notifyDepartmentNewSubmission } from '../utils/notifications';
import ProfileView from './ProfileView';
import DarkModeToggle from './DarkModeToggle';
import {
  collection,
  query,
  getDocs,
  setDoc,
  updateDoc,
  doc,
  onSnapshot,
  getDoc
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
  const [requirements, setRequirements] = useState({});
  const [requirementTemplates, setRequirementTemplates] = useState({});
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});
  const [previewFile, setPreviewFile] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchStudentData = async () => {
      try {
        const studentDoc = await getDoc(doc(db, 'students', user.uid));
        if (studentDoc.exists()) {
          setStudentData({ id: studentDoc.id, ...studentDoc.data() });
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
      }
    };

    fetchStudentData();

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

    const unsubscribers = departments.map(dept => {
      const reqDocRef = doc(db, 'clearance_requirements', dept.id, 'students', user.uid);

      return onSnapshot(reqDocRef, (docSnap) => {
        setRequirements(prev => ({
          ...prev,
          [dept.id]: docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
        }));
      });
    });

    setLoading(false);

    return () => {
      unsubscribeTemplates();
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user]);

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
      alert(`Some files are too large. Maximum size is 1MB per file.\n\nOversized files:\n${oversizedFiles.map(f => `• ${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`).join('\n')}`);
      return;
    }

    setUploading(prev => ({ ...prev, [deptId]: true }));

    try {
      console.log(`📤 Uploading ${files.length} file(s) to ${deptId}...`);

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

      const reqDocRef = doc(db, 'clearance_requirements', deptId, 'students', user.uid);
      const currentReq = requirements[deptId];

      if (currentReq) {
        await updateDoc(reqDocRef, {
          files: [...(currentReq.files || []), ...uploadedFiles],
          status: 'pending',
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(reqDocRef, {
          studentId: user.uid,
          studentName: studentData?.name || user.name,
          studentIdNumber: studentData?.studentId,
          course: studentData?.course,
          yearLevel: studentData?.yearLevel,
          semester: studentData?.semester,
          section: studentData?.section,
          email: user.email,
          status: 'pending',
          files: uploadedFiles,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      const deptName = departments.find(d => d.id === deptId)?.name || deptId;

      await createNotification(
        user.uid,
        'pending',
        `Files Uploaded to ${deptName}`,
        `Your ${uploadedFiles.length} file(s) have been submitted and are pending review.`,
        { department: deptId, fileCount: uploadedFiles.length }
      );

      await notifyDepartmentNewSubmission(
        deptId,
        studentData?.name || user.name,
        studentData?.studentId || 'N/A',
        uploadedFiles.length
      );

      alert(`✅ Files uploaded successfully to ${deptName}!\n\nThe department has been notified.`);
      event.target.value = '';

    } catch (error) {
      console.error('❌ Error uploading files:', error);
      alert('❌ Failed to upload files. Please try again.\n\nError: ' + error.message);
    } finally {
      setUploading(prev => ({ ...prev, [deptId]: false }));
    }
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

    const tableData = departments.map(dept => {
      const req = requirements[dept.id];
      return [
        dept.name,
        req?.status?.toUpperCase() || 'NOT SUBMITTED',
        req?.files?.length || 0,
        req?.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : 'N/A'
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

    const allApproved = departments.every(d => requirements[d.id]?.status === 'approved');
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
        return <CheckCircle className="text-green-600 dark:text-green-400" size={20} />;
      case 'rejected':
        return <XCircle className="text-red-600 dark:text-red-400" size={20} />;
      default:
        return <Clock className="text-amber-600 dark:text-amber-400" size={20} />;
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

  const approvedCount = departments.filter(d => requirements[d.id]?.status === 'approved').length;
  const submittedCount = departments.filter(d => requirements[d.id]).length;
  const progress = submittedCount > 0 ? (approvedCount / submittedCount) * 100 : 0;

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Clearance System</h1>
          <div className="flex items-center gap-4">
            <DarkModeToggle />
            <NotificationPanel />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <User size={20} className="text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-800 dark:text-gray-200">{user?.name}</span>
              </button>
              <ProfileView isOpen={showProfile} onClose={() => setShowProfile(false)} />
            </div>
            <button
              onClick={logout}
              className="bg-red-600 dark:bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6 p-6 transition-colors duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Welcome, {user?.name}</h2>
              <p className="text-gray-600 dark:text-gray-400">Student ID: {studentData?.studentId || 'N/A'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {studentData?.course} - {studentData?.yearLevel} - {studentData?.semester} - Section {studentData?.section}
              </p>
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Clearance Progress:</span>
                  <span className="text-sm text-indigo-600 dark:text-indigo-400 font-bold">
                    {approvedCount}/{submittedCount} Approved
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    ({submittedCount}/7 departments submitted)
                  </span>
                </div>
                <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
            >
              <Download size={20} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'overview' 
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white' 
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'upload' 
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white' 
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Upload Files
          </button>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Clearance Status Summary</h3>

            {departments.map(dept => {
              const req = requirements[dept.id];
              const hasSubmission = req !== null;
              const status = req?.status || 'not_submitted';
              const filesCount = req?.files?.length || 0;

              return (
                <div key={dept.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 hover:shadow-md transition-all duration-300 bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">{dept.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 dark:text-gray-100">{dept.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {!hasSubmission ? 'No submission yet' : `${filesCount} file${filesCount !== 1 ? 's' : ''} uploaded`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
                        status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' :
                        hasSubmission ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>
                        {status === 'approved' ? '✓ Approved' :
                          status === 'rejected' ? '✗ Rejected' :
                          hasSubmission ? '⏳ Pending' :
                          '○ Not Submitted'}
                      </span>
                    </div>
                  </div>

                  {status === 'rejected' && req.rejectionReason && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={18} />
                        <div>
                          <p className="text-sm font-medium text-red-800 dark:text-red-400">Rejection Reason:</p>
                          <p className="text-sm text-red-700 dark:text-red-400 mt-1">{req.rejectionReason}</p>
                          {req.missingRequirements && (
                            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
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
        )}

        {/* UPLOAD TAB */}
        {activeTab === 'upload' && (
          <div>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 dark:text-blue-400">
                📌 <strong>Upload files to each department separately.</strong> You can upload to one department now and others later. Each upload goes ONLY to the selected department.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map(dept => {
                const req = requirements[dept.id];
                const isUploading = uploading[dept.id];
                const isApproved = req?.status === 'approved';

                return (
                  <div key={dept.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{dept.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{dept.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-500">Upload files for this department only</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {isApproved ? (
                        <div className="border-2 border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/30 rounded-lg p-6 text-center">
                          <CheckCircle className="mx-auto mb-2 text-green-600 dark:text-green-400" size={40} />
                          <p className="font-semibold text-green-800 dark:text-green-400 mb-1">Clearance Approved! ✓</p>
                          <p className="text-sm text-green-700 dark:text-green-400">
                            File uploads are locked for this department.
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                            Contact the department if you need to make changes.
                          </p>
                        </div>
                      ) : (
                        <label className="block">
                          <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 ${
                            isUploading
                              ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 cursor-not-allowed'
                              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                          }`}>
                            <Upload className="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {isUploading ? 'Uploading...' : 'Click to upload files'}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF, JPG, PNG (max 1MB each)</p>
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
                      )}

                      {req?.files && req.files.length > 0 && (
                        <div className={`p-3 rounded-lg ${
                          req.status === 'approved' 
                            ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' :
                          req.status === 'rejected' 
                            ? 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800' :
                          'bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800'
                        }`}>
                          <p className={`text-sm font-medium mb-2 flex items-center gap-1 ${
                            req.status === 'approved' ? 'text-green-700 dark:text-green-400' :
                            req.status === 'rejected' ? 'text-red-700 dark:text-red-400' :
                            'text-amber-700 dark:text-amber-400'
                          }`}>
                            {getStatusIcon(req.status)}
                            <span className="ml-1">{getStatusText(req.status)}</span>
                          </p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {req.files.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                                <div className="flex items-center gap-2 flex-1">
                                  <FileText size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate text-gray-800 dark:text-gray-200">{file.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500">{(file.size / 1024).toFixed(1)}KB</p>
                                  </div>
                                </div>
                                <div className="flex gap-2 ml-2">
                                  <button
                                    onClick={() => previewFileHandler(file)}
                                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-xs px-2 py-1 border border-indigo-300 dark:border-indigo-700 rounded transition-colors"
                                  >
                                    Preview
                                  </button>
                                  <button
                                    onClick={() => downloadFile(file)}
                                    className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                                  >
                                    <Download size={16} />
                                  </button>
                                </div>
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
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 dark:bg-opacity-90 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{previewFile.name}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <XCircle size={24} />
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
                  className="w-full h-[70vh] border border-gray-300 dark:border-gray-600 rounded-lg"
                  title={previewFile.name}
                />
              ) : (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                  <p className="text-gray-600 dark:text-gray-400">Preview not available for this file type</p>
                  <button
                    onClick={() => downloadFile(previewFile)}
                    className="mt-4 bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
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
  );
}