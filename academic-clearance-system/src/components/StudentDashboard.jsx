// src/components/StudentDashboard.jsx (FIXED PDF ENCODING + SIGNATURES)
import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, Clock, Download, Bell, User, XCircle, AlertCircle, FileText, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationPanel from './NotificationPanel';
import { createNotification, notifyDepartmentNewSubmission } from '../utils/notifications';
import ProfileView from './profileView';
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
import autoTable from 'jspdf-autotable';

const departments = [
  { id: 'library', name: 'Library', icon: '📚' },
  { id: 'course_office', name: 'Course Office', icon: '🎓' },
  { id: 'guidance', name: 'Guidance', icon: '🧭' },
  { id: 'student_council', name: 'Student Council', icon: '👥' },
  { id: 'finance', name: 'Finance', icon: '💰' },
  { id: 'student_government', name: 'Student Government', icon: '🏛️' },
  { id: 'cashier', name: 'Cashier', icon: '💳' }
];

// FILE SECURITY CONFIGURATION
const ALLOWED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif',
  '.js', '.vbs', '.jar', '.app', '.deb', '.rpm',
  '.sh', '.py', '.rb', '.php', '.asp', '.jsp',
  '.dll', '.sys', '.msi', '.apk', '.dmg'
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

  const validateFile = (file) => {
    const errors = [];
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`"${file.name}" exceeds 5MB (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    }
    const fileName = file.name.toLowerCase();
    const fileExt = fileName.substring(fileName.lastIndexOf('.'));
    if (DANGEROUS_EXTENSIONS.includes(fileExt)) {
      errors.push(`"${file.name}" has dangerous extension (${fileExt}) - BLOCKED`);
    }
    const isAllowedType = Object.keys(ALLOWED_FILE_TYPES).includes(file.type);
    if (!isAllowedType) {
      errors.push(`"${file.name}" invalid type (${file.type}). Only PDF/JPG/PNG/WEBP allowed`);
    }
    if (isAllowedType) {
      const allowedExtensions = ALLOWED_FILE_TYPES[file.type];
      if (!allowedExtensions.includes(fileExt)) {
        errors.push(`"${file.name}" extension mismatch`);
      }
    }
    const extCount = (fileName.match(/\./g) || []).length;
    if (extCount > 1) {
      errors.push(`"${file.name}" has multiple extensions - BLOCKED`);
    }
    return errors;
  };

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

    const allErrors = [];
    files.forEach(file => {
      const errors = validateFile(file);
      allErrors.push(...errors);
    });

    if (allErrors.length > 0) {
      alert('🚫 SECURITY BLOCK\n\n' + allErrors.join('\n'));
      event.target.value = '';
      return;
    }

    setUploading(prev => ({ ...prev, [deptId]: true }));

    try {
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
      await createNotification(user.uid, 'pending', `Files Uploaded to ${deptName}`,
        `Your ${uploadedFiles.length} file(s) are pending review.`, { department: deptId, fileCount: uploadedFiles.length });
      await notifyDepartmentNewSubmission(deptId, studentData?.name || user.name, studentData?.studentId || 'N/A', uploadedFiles.length);

      alert(`✅ Uploaded to ${deptName}!`);
      event.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ Upload failed: ' + error.message);
    } finally {
      setUploading(prev => ({ ...prev, [deptId]: false }));
    }
  };

  const exportToPDF = () => {
    if (!studentData) return;

    try {
      const pdf = new jsPDF();

      // Header
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ACADEMIC CLEARANCE CERTIFICATE', 105, 20, { align: 'center' });
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });
      pdf.setTextColor(0);

      // Student Info
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Student Information', 20, 40);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Name: ${studentData.name || user.name}`, 20, 50);
      pdf.text(`Student ID: ${studentData.studentId || 'N/A'}`, 20, 57);
      pdf.text(`Course: ${studentData.course || 'N/A'}`, 20, 64);
      pdf.text(`Year: ${studentData.yearLevel || 'N/A'}`, 105, 64);
      pdf.text(`Semester: ${studentData.semester || 'N/A'}`, 20, 71);
      pdf.text(`Section: ${studentData.section || 'N/A'}`, 105, 71);

      // Stats
      const approved = departments.filter(d => requirements[d.id]?.status === 'approved').length;
      const pending = departments.filter(d => requirements[d.id]?.status === 'pending').length;
      const rejected = departments.filter(d => requirements[d.id]?.status === 'rejected').length;
      const notSubmitted = departments.filter(d => !requirements[d.id]).length;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Clearance Summary', 20, 85);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Approved: ${approved}`, 20, 93);
      pdf.text(`Pending: ${pending}`, 70, 93);
      pdf.text(`Rejected: ${rejected}`, 120, 93);
      pdf.text(`Not Submitted: ${notSubmitted}`, 170, 93);

      // Table with FIXED encoding
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Department Clearance Status', 20, 108);

      const tableData = departments.map(dept => {
        const req = requirements[dept.id];
        const status = req?.status || 'Not Submitted';
        const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);
        const files = req?.files?.length || 0;
        const submitted = req?.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-';
        const approvedDate = req?.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : '-';

        // FIX: Remove emojis from department names for PDF
        return [dept.name, statusDisplay, files.toString(), submitted, approvedDate];
      });

      autoTable(pdf, {
        startY: 113,
        head: [['Department', 'Status', 'Files', 'Submitted', 'Approved']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10
        },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          font: 'helvetica' // Force standard font
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 35, halign: 'center' },
          4: { cellWidth: 35, halign: 'center' }
        },
        didParseCell: function (data) {
          if (data.column.index === 1 && data.section === 'body') {
            const status = data.cell.text[0].toLowerCase();
            if (status === 'approved') {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'pending') {
              data.cell.styles.textColor = [245, 158, 11];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'rejected') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [107, 114, 128];
            }
          }
        }
      });

      const finalY = pdf.lastAutoTable.finalY || 113;

      // Overall Status
      const allApproved = departments.every(d => requirements[d.id]?.status === 'approved');
      const anyRejected = departments.some(d => requirements[d.id]?.status === 'rejected');

      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');

      if (allApproved) {
        pdf.setTextColor(22, 163, 74);
        pdf.text('CLEARANCE COMPLETE', 105, finalY + 15, { align: 'center' });
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('All departments have approved your clearance', 105, finalY + 22, { align: 'center' });
      } else if (anyRejected) {
        pdf.setTextColor(220, 38, 38);
        pdf.text('ACTION REQUIRED', 105, finalY + 15, { align: 'center' });
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Some requirements rejected - please resubmit', 105, finalY + 22, { align: 'center' });
      } else {
        pdf.setTextColor(245, 158, 11);
        pdf.text('CLEARANCE IN PROGRESS', 105, finalY + 15, { align: 'center' });
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Waiting for department approvals', 105, finalY + 22, { align: 'center' });
      }

      // SIGNATURE SECTION (only if all approved)
      if (allApproved) {
        pdf.setTextColor(0);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('CERTIFICATION', 105, finalY + 35, { align: 'center' });

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('This certifies that the above-named student has completed all', 105, finalY + 42, { align: 'center' });
        pdf.text('clearance requirements for the specified semester.', 105, finalY + 48, { align: 'center' });

        // Signature boxes
        const sigY = finalY + 60;

        // Left signature - Registrar
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.line(20, sigY, 80, sigY); // Signature line
        pdf.text('Signature Over Printed Name', 50, sigY + 5, { align: 'center' });
        pdf.setFont('helvetica', 'bold');
        pdf.text('REGISTRAR', 50, sigY + 10, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.line(20, sigY + 15, 80, sigY + 15); // Date line
        pdf.text('Date', 50, sigY + 20, { align: 'center' });

        // Right signature - Dean/Director
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.line(130, sigY, 190, sigY); // Signature line
        pdf.text('Signature Over Printed Name', 160, sigY + 5, { align: 'center' });
        pdf.setFont('helvetica', 'bold');
        pdf.text('DEAN / DIRECTOR', 160, sigY + 10, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.line(130, sigY + 15, 190, sigY + 15); // Date line
        pdf.text('Date', 160, sigY + 20, { align: 'center' });
      }

      // Footer
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(8);
      pdf.text('This is a computer-generated document.', 105, 280, { align: 'center' });
      pdf.text('For verification, contact the respective departments.', 105, 285, { align: 'center' });

      pdf.save(`Clearance_${studentData.studentId}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('❌ Failed to generate PDF. Error: ' + error.message);
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="text-green-600 dark:text-green-400" size={20} />;
      case 'rejected': return <XCircle className="text-red-600 dark:text-red-400" size={20} />;
      default: return <Clock className="text-amber-600 dark:text-amber-400" size={20} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return 'Pending Review';
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
      {/* Navbar – unchanged */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Clearance System</h1>
          <div className="flex items-center gap-4">
            <DarkModeToggle />
            <NotificationPanel />
            <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <User size={20} className="text-gray-600 dark:text-gray-400" />
              <span className="font-medium text-gray-800 dark:text-gray-200">{user?.name}</span>
            </button>
            <ProfileView isOpen={showProfile} onClose={() => setShowProfile(false)} />
            <button onClick={logout} className="bg-red-600 dark:bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 dark:hover:bg-red-600">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Card – unchanged */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Welcome, {user?.name}</h2>
              <p className="text-gray-600 dark:text-gray-400">Student ID: {studentData?.studentId || 'N/A'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {studentData?.course} - {studentData?.yearLevel} - {studentData?.semester} - Sec {studentData?.section}
              </p>
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress:</span>
                  <span className="text-sm text-indigo-600 dark:text-indigo-400 font-bold">
                    {approvedCount}/{submittedCount} Approved
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">({submittedCount}/7 submitted)</span>
                </div>
                <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
            <button onClick={exportToPDF} className="flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600">
              <Download size={20} />
              Export PDF
            </button>
          </div>
        </div>

        {/* ✅ TABS – now includes "requirements" */}
        <div className="flex gap-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'overview'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <CheckCircle size={18} className="inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'requirements'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <BookOpen size={18} className="inline mr-2" />
            Requirements
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'upload'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <Upload size={18} className="inline mr-2" />
            Upload
          </button>
        </div>

        {/* ✅ REQUIREMENTS TAB CONTENT */}
        {activeTab === 'requirements' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Clearance Requirements</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Created by the admin – what each department expects
              </span>
            </div>

            {Object.keys(requirementTemplates).length === 0 ? (
              <div className="text-center py-12">
                <List className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={48} />
                <p className="text-gray-500 dark:text-gray-400">No requirements have been set yet.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Check back later or contact your department.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {departments.map(dept => {
                  const deptTemplates = requirementTemplates[dept.id] || [];
                  if (deptTemplates.length === 0) return null;

                  return (
                    <div key={dept.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">{dept.icon}</span>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{dept.name}</h4>
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                          {deptTemplates.length} requirement{deptTemplates.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {deptTemplates.map((req) => (
                          <div
                            key={req.id}
                            className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
                                  <span className="font-medium text-gray-800 dark:text-gray-200">{req.title}</span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  {req.description || 'No description provided.'}
                                </p>
                                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${req.required
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                                  }`}>
                                  {req.required ? 'Required' : 'Optional'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* OVERVIEW TAB – unchanged */}
        {activeTab === 'overview' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Status Summary</h3>
            {/* ... your existing overview code ... */}
            {departments.map(dept => {
              const req = requirements[dept.id];
              const status = req?.status || 'not_submitted';
              return (
                <div key={dept.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">{dept.icon}</span>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-100">{dept.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {!req ? 'Not submitted' : `${req.files?.length || 0} files`}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
                        status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' :
                          req ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' :
                            'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>
                      {status === 'approved' ? '✓ Approved' : status === 'rejected' ? '✗ Rejected' : req ? '⏳ Pending' : '○ Not Submitted'}
                    </span>
                  </div>
                  {status === 'rejected' && req.rejectionReason && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm font-medium text-red-800 dark:text-red-400">Reason: {req.rejectionReason}</p>
                      {req.missingRequirements && <p className="text-sm text-red-700 dark:text-red-400 mt-1">Missing: {req.missingRequirements}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* UPLOAD TAB – unchanged (already present) */}
        {activeTab === 'upload' && (
          <div>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 dark:text-blue-400 mb-2">
                📌 Upload files per department. Max 5MB each. Allowed: PDF, JPG, PNG, WEBP
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                🔒 Executables and scripts blocked for security
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* ... your existing upload cards ... */}
            </div>
          </div>
        )}
      </div>

      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 dark:bg-opacity-90 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{previewFile.name}</h3>
              <button onClick={() => setPreviewFile(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <XCircle size={24} />
              </button>
            </div>
            <div className="flex justify-center">
              {previewFile.type.startsWith('image/') ? (
                <img src={previewFile.data} alt={previewFile.name} className="max-w-full h-auto rounded-lg" />
              ) : previewFile.type === 'application/pdf' ? (
                <iframe src={previewFile.data} className="w-full h-[70vh] border border-gray-300 dark:border-gray-600 rounded-lg" title={previewFile.name} />
              ) : (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                  <p className="text-gray-600 dark:text-gray-400">Preview not available</p>
                  <button onClick={() => downloadFile(previewFile)} className="mt-4 bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2 rounded-lg">Download</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}