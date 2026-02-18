// src/components/StudentDashboard.jsx – FIXED: rejected allows re‑upload
import React, { useState, useEffect } from 'react';
import {
  Upload, CheckCircle, Clock, Download, Bell, User,
  XCircle, AlertCircle, FileText, BookOpen, List
} from 'lucide-react';
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
          const data = studentDoc.data();
          setStudentData({
            id: studentDoc.id,
            ...data,
            studentId: data.studentId || data.studentIdNumber || 'Not set',
            course: data.course || 'No course',
            yearLevel: data.yearLevel || 'No year',
            semester: data.semester || 'No semester',
            section: data.section || 'N/A'
          });
          console.log('✅ Student data loaded from students collection');
        } else {
          console.warn('⚠️ Student document not found, checking user document...');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'student') {
            const userData = userDoc.data();
            setStudentData({
              id: user.uid,
              name: userData.name || user.displayName || 'Student',
              email: user.email,
              studentId: userData.studentId || 'Not set',
              course: userData.course || 'No course',
              yearLevel: userData.yearLevel || 'No year',
              semester: userData.semester || 'No semester',
              section: userData.section || 'N/A'
            });
            console.log('✅ Using user document as fallback');
          } else {
            setStudentData(null);
          }
        }
      } catch (error) {
        console.error('🔥 Error fetching student data:', error);
        setStudentData({
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Student',
          email: user.email,
          studentId: 'Error loading',
          course: 'Error loading',
          yearLevel: 'Error loading',
          semester: 'Error loading',
          section: 'N/A'
        });
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

      // --- Header ---
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ACADEMIC CLEARANCE CERTIFICATE', 105, 20, { align: 'center' });
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });
      pdf.setTextColor(0);

      // --- Student Info ---
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

      // --- Clearance Summary Stats ---
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

      // --- Department Status Table (with Approver Name) ---
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Department Clearance Status', 20, 108);

      const tableData = departments.map(dept => {
        const req = requirements[dept.id];
        const status = req?.status || 'Not Submitted';
        const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);

        // ✅ Get approver's full name – NOT UID or email
        let approvedBy = '—';
        if (status === 'approved') {
          approvedBy =
            req?.approvedByName ||        // 1. Full name (preferred)
            req?.approvedBy ||            // 2. Legacy name field (if stored)
            req?.approvedByEmail?.split('@')[0] || // 3. Fallback to email username
            'N/A';
        }

        const approvedDate = req?.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : '—';

        return [
          dept.name,
          statusDisplay,
          approvedBy,
          approvedDate
        ];
      });

      autoTable(pdf, {
        startY: 113,
        head: [['Department', 'Status', 'Approved By', 'Date Approved']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center'  // ✅ center header text
        },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          font: 'helvetica',
          overflow: 'linebreak',
          halign: 'center'  // ✅ center ALL cell content
        },
        columnStyles: {
          0: { cellWidth: 50 },          // Department (still centered)
          1: { cellWidth: 30 },          // Status
          2: { cellWidth: 45 },          // Approved By
          3: { cellWidth: 30 }           // Date Approved
        },
        margin: {
          left: (pdf.internal.pageSize.width - 155) / 2  // ✅ dynamically center table
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

      let finalY = pdf.lastAutoTable.finalY || 113;
      finalY += 10;

      // --- Overall Status ---
      const allApproved = departments.every(d => requirements[d.id]?.status === 'approved');
      const anyRejected = departments.some(d => requirements[d.id]?.status === 'rejected');

      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');

      if (allApproved) {
        pdf.setTextColor(22, 163, 74);
        pdf.text('CLEARANCE COMPLETE', 105, finalY, { align: 'center' });
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('All departments have approved your clearance', 105, finalY + 7, { align: 'center' });
        finalY += 15;
      } else if (anyRejected) {
        pdf.setTextColor(220, 38, 38);
        pdf.text('ACTION REQUIRED', 105, finalY, { align: 'center' });
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Some requirements rejected - please resubmit', 105, finalY + 7, { align: 'center' });
        finalY += 15;
      } else {
        pdf.setTextColor(245, 158, 11);
        pdf.text('CLEARANCE IN PROGRESS', 105, finalY, { align: 'center' });
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Waiting for department approvals', 105, finalY + 7, { align: 'center' });
        finalY += 15;
      }

      // --- Registrar & Dean Signatures (only if fully cleared) ---
      if (allApproved) {
        pdf.setTextColor(0);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('CERTIFICATION', 105, finalY, { align: 'center' });
        finalY += 5;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('This certifies that the above-named student has completed all', 105, finalY + 2, { align: 'center' });
        pdf.text('clearance requirements for the specified semester.', 105, finalY + 8, { align: 'center' });
        finalY += 15;

        const sigY = finalY;
        pdf.line(20, sigY, 80, sigY);
        pdf.text('Signature Over Printed Name', 50, sigY + 5, { align: 'center' });
        pdf.setFont('helvetica', 'bold');
        pdf.text('REGISTRAR', 50, sigY + 10, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.line(20, sigY + 15, 80, sigY + 15);
        pdf.text('Date', 50, sigY + 20, { align: 'center' });

        pdf.line(130, sigY, 190, sigY);
        pdf.text('Signature Over Printed Name', 160, sigY + 5, { align: 'center' });
        pdf.setFont('helvetica', 'bold');
        pdf.text('DEAN / DIRECTOR', 160, sigY + 10, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.line(130, sigY + 15, 190, sigY + 15);
        pdf.text('Date', 160, sigY + 20, { align: 'center' });
      }

      // --- Footer ---
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(8);
      pdf.text('This is a computer-generated document.', 105, 280, { align: 'center' });
      pdf.text('For verification, contact the respective departments.', 105, 285, { align: 'center' });

      pdf.save(`Clearance_${studentData.studentId || 'student'}_${new Date().toISOString().split('T')[0]}.pdf`);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 overflow-x-hidden">

      {/* ✅ RESPONSIVE NAVBAR */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
              <CheckCircle className="text-indigo-600 dark:text-indigo-400" size={24} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 truncate">
              Clearance System
            </h1>
          </div>
          <div className="flex items-center justify-end gap-0.5 sm:gap-1.5">
            <DarkModeToggle />
            <NotificationPanel />
            <button
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-0.5 px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <User size={16} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 max-w-[80px] sm:max-w-[100px] truncate">
                {user?.name}
              </span>
            </button>
            <button
              onClick={logout}
              className="bg-red-600 dark:bg-red-500 text-white px-2 py-1 rounded-lg text-xs hover:bg-red-700 dark:hover:bg-red-600 transition-colors whitespace-nowrap"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Welcome Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6 p-5 sm:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                Welcome, {user?.name}
              </h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Student ID: {studentData?.studentId || studentData?.studentIdNumber || 'Not set'}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500">
                {studentData?.course || 'No course'} - {studentData?.yearLevel || 'No year'} - {studentData?.semester || 'No semester'} - Sec {studentData?.section || 'N/A'}
              </p>
              <div className="mt-3 w-full sm:w-64 md:w-72">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Progress:</span>
                  <span className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 font-bold">
                    {approvedCount}/{submittedCount} Approved
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    ({submittedCount}/7 submitted)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <Download size={18} />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 sm:gap-4 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
              activeTab === 'overview'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <CheckCircle size={16} className="inline mr-1 sm:mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
              activeTab === 'requirements'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <BookOpen size={16} className="inline mr-1 sm:mr-2" />
            Requirements
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
              activeTab === 'upload'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Upload size={16} className="inline mr-1 sm:mr-2" />
            Upload
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Status Summary</h3>
            {departments.map(dept => {
              const req = requirements[dept.id];
              const status = req?.status || 'not_submitted';
              return (
                <div key={dept.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 hover:shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{dept.icon}</span>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-100">{dept.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {!req ? 'Not submitted' : `${req.files?.length || 0} files`}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold self-start sm:self-center ${
                      status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
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

        {/* Requirements Tab */}
        {activeTab === 'requirements' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">Clearance Requirements</h3>
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Created by the admin – what each department expects
              </span>
            </div>

            {Object.keys(requirementTemplates).length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <List className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={40} />
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
                          <div key={req.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex items-start gap-2">
                              <FileText size={16} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-1" />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-gray-800 dark:text-gray-200 block break-words">
                                  {req.title}
                                </span>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                                  {req.description || 'No description provided.'}
                                </p>
                                <span className={`inline-block px-2 py-1 mt-2 text-xs font-medium rounded-full ${
                                  req.required
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

        {/* ✅ UPLOAD TAB – modified for rejected departments to allow re‑upload */}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map(dept => {
                const req = requirements[dept.id];
                const isApproved = req?.status === 'approved';
                const isRejected = req?.status === 'rejected';
                const showUpload = !isApproved; // show for rejected and pending/not submitted

                return (
                  <div key={dept.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 sm:p-6 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{dept.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 truncate">
                          {dept.name}
                        </h3>
                        {req && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {req.files?.length || 0} file(s) uploaded
                          </p>
                        )}
                      </div>
                    </div>

                    {isApproved ? (
                      // ✅ Approved – no upload, just success message
                      <div className="border-2 border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/30 rounded-lg p-6 text-center">
                        <CheckCircle className="mx-auto mb-2 text-green-600 dark:text-green-400" size={40} />
                        <p className="font-semibold text-green-800 dark:text-green-400">Approved ✓</p>
                      </div>
                    ) : (
                      <>
                        {/* Show rejection reason if rejected */}
                        {isRejected && (
                          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm font-medium text-red-800 dark:text-red-400">
                              Rejected: {req?.rejectionReason}
                            </p>
                            {req?.missingRequirements && (
                              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                                Missing: {req.missingRequirements}
                              </p>
                            )}
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                              Please upload corrected files.
                            </p>
                          </div>
                        )}

                        {/* Upload area – shown for rejected, pending, or not submitted */}
                        <label className="block">
                          <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                            uploading[dept.id]
                              ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 cursor-not-allowed'
                              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                          }`}>
                            <Upload className="mx-auto mb-2 text-gray-400 dark:text-gray-500" size={24} />
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {uploading[dept.id] ? 'Uploading...' : 'Click to upload'}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              PDF/JPG/PNG/WEBP (5MB max)
                            </p>
                            <input
                              type="file"
                              multiple
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              className="hidden"
                              onChange={(e) => handleFileUpload(dept.id, e)}
                              disabled={uploading[dept.id]}
                            />
                          </div>
                        </label>

                        {/* Show existing files (for rejected or pending) */}
                        {req?.files && req.files.length > 0 && (
                          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <p className="text-sm font-medium mb-2 flex items-center gap-1">
                              {getStatusIcon(req.status)} {getStatusText(req.status)}
                            </p>
                            <div className="space-y-2">
                              {req.files.slice(-3).map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                                  <FileText size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                  <p className="text-xs flex-1 ml-2 truncate text-gray-800 dark:text-gray-200">
                                    {file.name}
                                  </p>
                                  <button
                                    onClick={() => previewFileHandler(file)}
                                    className="text-indigo-600 dark:text-indigo-400 text-xs px-2 py-1 border rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 whitespace-nowrap"
                                  >
                                    Preview
                                  </button>
                                </div>
                              ))}
                              {req.files.length > 3 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  +{req.files.length - 3} more file(s)
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ProfileView isOpen={showProfile} onClose={() => setShowProfile(false)} />

      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 dark:bg-opacity-90 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 break-words">{previewFile.name}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0 ml-4"
              >
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
                  <button
                    onClick={() => downloadFile(previewFile)}
                    className="mt-4 bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2 rounded-lg"
                  >
                    Download
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