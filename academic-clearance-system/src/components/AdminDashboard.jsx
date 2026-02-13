// src/components/AdminDashboard.jsx – COMPLETE with Bulk Semester Update + Fixed Total Cleaner
import React, { useState, useEffect } from 'react';
import {
  Users, Activity, CheckCircle, Clock, AlertCircle, Key,
  Settings, FileText, Trash2, Plus, Edit2, Shield, History,
  Database, Download, Upload, Search, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DarkModeToggle from './DarkModeToggle';
import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  where,
  orderBy,
  limit,
  setDoc,
  writeBatch,
  getDoc
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

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClearances: 0,
    pendingApprovals: 0,
    completedClearances: 0,
    totalDepartments: 7
  });
  const [tokens, setTokens] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [newToken, setNewToken] = useState({
    department: 'library',
    expiresIn: 7
  });
  const [newRequirement, setNewRequirement] = useState({
    department: 'library',
    title: '',
    description: '',
    required: true
  });

  // Backup & Recovery state
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState(null);
  const [collectionList] = useState([
    'users',
    'students',
    'clearances',
    'department_tokens',
    'requirements_templates',
    'audit_logs',
    'sessions',
    'student_ids',
    'clearance_requirements'
  ]);

  // Total Cleaner state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [clearLoading, setClearLoading] = useState(false);

  // Quota timer state
  const [timeUntilReset, setTimeUntilReset] = useState('');
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // STUDENT STATUS STATE
  const [studentClearances, setStudentClearances] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 🆕 BULK SEMESTER UPDATE STATE
  const [bulkSemester, setBulkSemester] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // ========== AUDIT TRAIL FUNCTION ==========
  const logAuditEvent = async (action, details) => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        action,
        details,
        performedBy: user.email,
        performedById: user.uid,
        timestamp: new Date().toISOString(),
        userRole: user.role
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  };

  // ========== QUOTA RESET COUNTDOWN TIMER ==========
  useEffect(() => {
    const checkQuotaStatus = async () => {
      try {
        const testRef = doc(db, '_quota_test', 'test');
        await setDoc(testRef, { timestamp: new Date().toISOString() });
        await deleteDoc(testRef);
        setQuotaExceeded(false);
      } catch (error) {
        if (error.code === 'resource-exhausted') {
          setQuotaExceeded(true);
        }
      }
    };
    checkQuotaStatus();

    const updateTimer = () => {
      const now = new Date();
      const resetTime = new Date();
      resetTime.setUTCHours(8, 0, 0, 0);
      const month = now.getUTCMonth();
      const isDaylight = month >= 2 && month <= 10;
      if (isDaylight) resetTime.setUTCHours(7, 0, 0, 0);
      if (resetTime < now) resetTime.setDate(resetTime.getDate() + 1);
      const diffMs = resetTime - now;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeUntilReset(`${hours}h ${minutes}m ${seconds}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // ========== STATS & REAL-TIME SUBSCRIPTIONS ==========
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const totalStudents = studentsSnapshot.size;
        const clearancesSnapshot = await getDocs(collection(db, 'clearances'));
        const totalClearances = clearancesSnapshot.size;
        let pendingCount = 0;
        for (const dept of departments) {
          try {
            const requirementsRef = collection(db, 'clearance_requirements', dept.id, 'students');
            const snapshot = await getDocs(requirementsRef);
            pendingCount += snapshot.docs.filter(doc => doc.data().status === 'pending').length;
          } catch (deptError) {
            console.warn(`Could not fetch requirements for ${dept.name}:`, deptError);
          }
        }
        const completedCount = clearancesSnapshot.docs.filter(
          doc => doc.data().status === 'completed'
        ).length;
        setStats({
          totalStudents,
          totalClearances,
          pendingApprovals: pendingCount,
          completedClearances: completedCount,
          totalDepartments: 7
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();

    const tokensQuery = query(collection(db, 'department_tokens'));
    const unsubscribeTokens = onSnapshot(tokensQuery, (snapshot) => {
      setTokens(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const requirementsQuery = query(collection(db, 'requirements_templates'));
    const unsubscribeReqs = onSnapshot(requirementsQuery, (snapshot) => {
      setRequirements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const auditQuery = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const unsubscribeAudit = onSnapshot(auditQuery, (snapshot) => {
      setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const fetchUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchUsers();

    return () => {
      unsubscribeTokens();
      unsubscribeReqs();
      unsubscribeAudit();
    };
  }, []);

  // ========== FETCH STUDENT CLEARANCES ==========
  const fetchStudentClearances = async () => {
    setLoadingStudents(true);
    try {
      let students = [];
      try {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        students = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          _source: 'students'
        }));
      } catch (error) {
        console.warn('Could not fetch from students collection:', error);
      }

      if (students.length === 0) {
        console.log('⚠️ No students in students collection, falling back to users...');
        const usersSnapshot = await getDocs(collection(db, 'users'));
        students = usersSnapshot.docs
          .filter(doc => doc.data().role === 'student')
          .map(doc => ({
            id: doc.id,
            name: doc.data().name,
            email: doc.data().email,
            studentId: doc.data().studentId || 'Not set',
            course: doc.data().course || 'No course',
            yearLevel: doc.data().yearLevel || 'No year',
            semester: doc.data().semester || 'No semester',
            section: doc.data().section || 'N/A',
            _source: 'users'
          }));
      }

      if (students.length === 0) {
        setStudentClearances([]);
        setLoadingStudents(false);
        return;
      }

      const studentData = await Promise.all(
        students.map(async (student) => {
          const deptStatuses = {};
          await Promise.all(
            departments.map(async (dept) => {
              try {
                const reqDocRef = doc(db, 'clearance_requirements', dept.id, 'students', student.id);
                const reqDoc = await getDoc(reqDocRef);
                if (reqDoc.exists()) {
                  const data = reqDoc.data();
                  deptStatuses[dept.id] = {
                    status: data.status || 'not_submitted',
                    approvedAt: data.approvedAt,
                    approvedBy: data.approvedByName || data.approvedBy || '—',
                    filesCount: data.files?.length || 0
                  };
                } else {
                  deptStatuses[dept.id] = { status: 'not_submitted' };
                }
              } catch (error) {
                console.error(`Error fetching ${dept.id} for student ${student.id}:`, error);
                deptStatuses[dept.id] = { status: 'error' };
              }
            })
          );
          const approved = Object.values(deptStatuses).filter(d => d.status === 'approved').length;
          const pending = Object.values(deptStatuses).filter(d => d.status === 'pending').length;
          const rejected = Object.values(deptStatuses).filter(d => d.status === 'rejected').length;
          const notSubmitted = Object.values(deptStatuses).filter(d => d.status === 'not_submitted').length;
          return {
            ...student,
            deptStatuses,
            summary: { approved, pending, rejected, notSubmitted, total: departments.length }
          };
        })
      );

      setStudentClearances(studentData);
    } catch (error) {
      console.error('Error fetching student clearances:', error);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'studentStatus') {
      fetchStudentClearances();
    }
  }, [activeTab]);

  const filteredStudents = studentClearances.filter(student => {
    const term = searchTerm.toLowerCase();
    return (
      student.name?.toLowerCase().includes(term) ||
      student.studentId?.toLowerCase().includes(term) ||
      student.course?.toLowerCase().includes(term) ||
      student.section?.toLowerCase().includes(term) ||
      student.email?.toLowerCase().includes(term)
    );
  });

  // ========== 🆕 BULK SEMESTER UPDATE HANDLER ==========
  const handleBulkSemesterUpdate = async () => {
    if (!bulkSemester) {
      alert('Please select a semester.');
      return;
    }

    if (!confirm(`⚠️ This will set the semester to "${bulkSemester}" for ALL students.\n\nAre you sure?`)) {
      return;
    }

    setBulkUpdating(true);

    try {
      // 1. Get all student documents
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const studentIds = studentsSnapshot.docs.map(doc => doc.id);

      // 2. Get all user documents with role 'student'
      const usersQuery = query(collection(db, 'users'), where('role', '==', 'student'));
      const usersSnapshot = await getDocs(usersQuery);
      const userIds = usersSnapshot.docs.map(doc => doc.id);

      let updatedCount = 0;
      const BATCH_SIZE = 200;
      const DELAY_MS = 1500;

      const processBatch = async (ids, collectionName) => {
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          const batchIds = ids.slice(i, i + BATCH_SIZE);

          batchIds.forEach(id => {
            const docRef = doc(db, collectionName, id);
            batch.update(docRef, { semester: bulkSemester });
          });

          await batch.commit();
          updatedCount += batchIds.length;

          if (i + BATCH_SIZE < ids.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
          }
        }
      };

      if (studentIds.length > 0) {
        await processBatch(studentIds, 'students');
      }

      if (userIds.length > 0) {
        await processBatch(userIds, 'users');
      }

      await logAuditEvent('BULK_SEMESTER_UPDATE', {
        semester: bulkSemester,
        studentsUpdated: studentIds.length,
        usersUpdated: userIds.length,
        timestamp: new Date().toISOString()
      });

      alert(`✅ Successfully updated semester to "${bulkSemester}" for ${studentIds.length} student records and ${userIds.length} user profiles.`);

      if (activeTab === 'studentStatus') {
        fetchStudentClearances();
      }

      setBulkSemester('');
    } catch (error) {
      console.error('Error updating semesters:', error);
      alert('❌ Failed to update semesters: ' + error.message);
    } finally {
      setBulkUpdating(false);
    }
  };

  // ========== BACKUP & RECOVERY HANDLERS ==========
  const handleExportBackup = async () => {
    if (selectedCollections.length === 0) {
      setBackupMessage({ type: 'error', text: 'Please select at least one collection.' });
      return;
    }
    setBackupLoading(true);
    setBackupMessage(null);
    try {
      const backupData = {};
      const skippedCollections = [];
      for (const collectionName of selectedCollections) {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          backupData[collectionName] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (error) {
          console.warn(`⚠️ Skipping ${collectionName}: ${error.message}`);
          skippedCollections.push(collectionName);
        }
      }
      if (Object.keys(backupData).length === 0) {
        throw new Error('No collections could be read. Check permissions.');
      }
      backupData._metadata = {
        exportedAt: new Date().toISOString(),
        exportedBy: user?.email,
        collections: Object.keys(backupData).filter(k => k !== '_metadata'),
        version: '1.0'
      };
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `firestore-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      const successMessage = `✅ Backup successful! Exported ${Object.keys(backupData).length - 1} collection(s).`;
      const warningMessage = skippedCollections.length > 0
        ? ` ⚠️ Skipped: ${skippedCollections.join(', ')} (no read permission)`
        : '';
      setBackupMessage({ type: 'success', text: successMessage + warningMessage });
      await logAuditEvent('BACKUP_EXPORTED', {
        collections: Object.keys(backupData).filter(k => k !== '_metadata'),
        skipped: skippedCollections,
        documentCounts: Object.fromEntries(
          Object.keys(backupData).filter(k => k !== '_metadata').map(col => [col, backupData[col]?.length || 0])
        )
      });
    } catch (error) {
      console.error('Export error:', error);
      setBackupMessage({ type: 'error', text: '❌ Export failed: ' + error.message });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportBackup = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!confirm('⚠️ WARNING: This will OVERWRITE existing documents with the same IDs. Are you absolutely sure?')) {
      event.target.value = '';
      return;
    }
    setRestoreLoading(true);
    setBackupMessage(null);
    try {
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);
      if (!backupData._metadata) {
        throw new Error('Invalid backup file: missing metadata.');
      }
      let totalRestored = 0;
      for (const [collectionName, documents] of Object.entries(backupData)) {
        if (collectionName === '_metadata') continue;
        if (!Array.isArray(documents)) {
          console.warn(`Skipping ${collectionName}: not an array`);
          continue;
        }
        for (const docData of documents) {
          if (!docData.id) {
            console.warn(`Skipping document in ${collectionName}: missing id`);
            continue;
          }
          const { id, ...data } = docData;
          const docRef = doc(db, collectionName, id);
          await setDoc(docRef, data);
          totalRestored++;
        }
      }
      setBackupMessage({
        type: 'success',
        text: `✅ Restore complete! ${totalRestored} documents restored from ${Object.keys(backupData).length - 1} collection(s).`
      });
      await logAuditEvent('BACKUP_RESTORED', {
        filename: file.name,
        collections: Object.keys(backupData).filter(k => k !== '_metadata'),
        documentCount: totalRestored
      });
    } catch (error) {
      console.error('Restore error:', error);
      setBackupMessage({ type: 'error', text: '❌ Restore failed: ' + error.message });
    } finally {
      setRestoreLoading(false);
      event.target.value = '';
    }
  };
  // ========== FIXED TOTAL CLEANER – supports clearance_requirements subcollections ==========
  const handleClearCollections = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('❌ Please type "DELETE" to confirm.');
      return;
    }
    if (selectedCollections.length === 0) {
      alert('Please select at least one collection to clear.');
      return;
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
      alert('❌ Admin verification failed. Cannot delete.');
      return;
    }

    const reallySure = window.confirm(
      `🔥 FINAL WARNING: You are about to delete ALL documents from:\n\n` +
      selectedCollections.join(', ') +
      (selectedCollections.includes('clearance_requirements')
        ? '\n\n⚠️ This includes ALL clearance_requirements (all departments, all students).'
        : '') +
      `\n\n⚠️ Spark plan: 20,000 writes/deletes per day.\n` +
      `This operation is EXTREMELY SLOW (3s delay between batches of 20).\n` +
      `Large collections may take hours.\n\n` +
      `Do you have a backup ready?`
    );
    if (!reallySure) return;

    setClearLoading(true);
    try {
      let totalDeleted = 0;
      const failedCollections = [];
      const BATCH_SIZE = 20;
      const DELAY_MS = 3000;
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      for (const collectionName of selectedCollections) {
        console.log(`🔄 Clearing "${collectionName}"...`);

        // --- SPECIAL CASE: clearance_requirements (subcollections under each department) ---
        if (collectionName === 'clearance_requirements') {
          for (const dept of departments) {
            const subcollectionPath = `clearance_requirements/${dept.id}/students`;
            try {
              const subcollectionRef = collection(db, subcollectionPath);
              const snapshot = await getDocs(subcollectionRef);
              const docs = snapshot.docs;
              if (docs.length === 0) {
                console.log(`   No documents in ${subcollectionPath}`);
                continue;
              }

              for (let i = 0; i < docs.length; i += BATCH_SIZE) {
                try {
                  const batch = writeBatch(db);
                  const batchDocs = docs.slice(i, i + BATCH_SIZE);
                  batchDocs.forEach(doc => batch.delete(doc.ref));
                  await batch.commit();
                  totalDeleted += batchDocs.length;
                  console.log(`   ✅ Batch deleted ${batchDocs.length} docs from ${subcollectionPath} (total ${totalDeleted})`);
                } catch (batchError) {
                  console.warn(`   ⚠️ Batch delete failed for ${subcollectionPath}, falling back...`, batchError);
                  for (let j = i; j < Math.min(i + BATCH_SIZE, docs.length); j++) {
                    try {
                      await deleteDoc(docs[j].ref);
                      totalDeleted++;
                    } catch (singleError) {
                      console.error(`     ❌ Failed to delete doc ${docs[j].id}:`, singleError);
                      failedCollections.push(`${subcollectionPath}/${docs[j].id}`);
                    }
                    await sleep(100);
                  }
                }
                if (i + BATCH_SIZE < docs.length) await sleep(DELAY_MS);
              }
            } catch (error) {
              console.error(`❌ Failed to process ${subcollectionPath}:`, error);
              if (error.code === 'permission-denied') {
                alert(`❌ Permission denied for ${subcollectionPath}. Check Firestore rules.`);
              }
              failedCollections.push(subcollectionPath);
            }
          }
          continue; // skip the top-level delete for clearance_requirements
        }

        // --- NORMAL CASE: top-level collection ---
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          const docs = snapshot.docs;
          if (docs.length === 0) {
            console.log(`   Collection "${collectionName}" is empty.`);
            continue;
          }

          for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            try {
              const batch = writeBatch(db);
              const batchDocs = docs.slice(i, i + BATCH_SIZE);
              batchDocs.forEach(doc => batch.delete(doc.ref));
              await batch.commit();
              totalDeleted += batchDocs.length;
              console.log(`   ✅ Batch deleted ${batchDocs.length} docs from ${collectionName} (total ${totalDeleted})`);
            } catch (batchError) {
              console.warn(`   ⚠️ Batch delete failed for ${collectionName}, falling back...`, batchError);
              for (let j = i; j < Math.min(i + BATCH_SIZE, docs.length); j++) {
                try {
                  await deleteDoc(docs[j].ref);
                  totalDeleted++;
                } catch (singleError) {
                  console.error(`     ❌ Failed to delete doc ${docs[j].id}:`, singleError);
                  failedCollections.push(`${collectionName}/${docs[j].id}`);
                }
                await sleep(100);
              }
            }
            if (i + BATCH_SIZE < docs.length) await sleep(DELAY_MS);
          }
        } catch (error) {
          console.error(`❌ Failed to process collection "${collectionName}":`, error);
          if (error.code === 'resource-exhausted') {
            alert(`❌ Quota exceeded! Stopped at ${totalDeleted} deletions. Upgrade to Blaze or wait 24h.`);
            break;
          }
          if (error.code === 'permission-denied') {
            alert(`❌ Permission denied for collection "${collectionName}". Check Firestore rules.`);
          }
          failedCollections.push(collectionName);
        }
      }

      await logAuditEvent('TOTAL_CLEANER_EXECUTED', {
        collections: selectedCollections.filter(c => !failedCollections.includes(c)),
        deletedCount: totalDeleted,
        failedCollections
      });

      alert(`✅ Cleared ${totalDeleted} documents.` + (failedCollections.length > 0 ? ` ⚠️ Failed: ${failedCollections.join(', ')}` : ''));
      setDeleteConfirmText('');
    } catch (error) {
      console.error('🔥 Fatal cleaner error:', error);
      alert('❌ Cleaner failed: ' + error.message);
    } finally {
      setClearLoading(false);
    }
  };

  // ========== TOKEN MANAGEMENT ==========
  const generateToken = async () => {
    try {
      const token = Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(newToken.expiresIn));
      await addDoc(collection(db, 'department_tokens'), {
        token,
        department: newToken.department,
        expiresAt: expiryDate.toISOString(),
        used: false,
        createdAt: new Date().toISOString()
      });
      await logAuditEvent('TOKEN_GENERATED', {
        department: departments.find(d => d.id === newToken.department)?.name,
        expiresAt: expiryDate.toISOString()
      });
      alert(`Token generated successfully!\n\nToken: ${token}\nExpires: ${expiryDate.toLocaleDateString()}\n\nShare this with the ${departments.find(d => d.id === newToken.department)?.name} department.`);
      setShowTokenModal(false);
      setNewToken({ department: 'library', expiresIn: 7 });
    } catch (error) {
      console.error('Error generating token:', error);
      alert('Failed to generate token. Error: ' + error.message);
    }
  };

  const deleteToken = async (tokenId) => {
    if (!confirm('Are you sure you want to delete this token?')) return;
    try {
      const tokenToDelete = tokens.find(t => t.id === tokenId);
      await deleteDoc(doc(db, 'department_tokens', tokenId));
      await logAuditEvent('TOKEN_DELETED', {
        department: departments.find(d => d.id === tokenToDelete?.department)?.name,
        tokenId
      });
      alert('Token deleted successfully');
    } catch (error) {
      console.error('Error deleting token:', error);
      alert('Failed to delete token');
    }
  };

  // ========== REQUIREMENT MANAGEMENT ==========
  const saveRequirement = async () => {
    try {
      if (editingRequirement) {
        await updateDoc(doc(db, 'requirements_templates', editingRequirement.id), {
          ...newRequirement,
          updatedAt: new Date().toISOString()
        });
        await logAuditEvent('REQUIREMENT_UPDATED', {
          department: departments.find(d => d.id === newRequirement.department)?.name,
          title: newRequirement.title
        });
        alert('Requirement updated successfully');
      } else {
        await addDoc(collection(db, 'requirements_templates'), {
          ...newRequirement,
          createdAt: new Date().toISOString()
        });
        await logAuditEvent('REQUIREMENT_CREATED', {
          department: departments.find(d => d.id === newRequirement.department)?.name,
          title: newRequirement.title
        });
        alert('Requirement added successfully');
      }
      setShowRequirementModal(false);
      setEditingRequirement(null);
      setNewRequirement({
        department: 'library',
        title: '',
        description: '',
        required: true
      });
    } catch (error) {
      console.error('Error saving requirement:', error);
      alert('Failed to save requirement. Error: ' + error.message);
    }
  };

  const editRequirement = (req) => {
    setEditingRequirement(req);
    setNewRequirement({
      department: req.department,
      title: req.title,
      description: req.description,
      required: req.required
    });
    setShowRequirementModal(true);
  };

  const deleteRequirement = async (reqId) => {
    if (!confirm('Are you sure you want to delete this requirement?')) return;
    try {
      const reqToDelete = requirements.find(r => r.id === reqId);
      await deleteDoc(doc(db, 'requirements_templates', reqId));
      await logAuditEvent('REQUIREMENT_DELETED', {
        department: departments.find(d => d.id === reqToDelete?.department)?.name,
        title: reqToDelete?.title
      });
      alert('Requirement deleted successfully');
    } catch (error) {
      console.error('Error deleting requirement:', error);
      alert('Failed to delete requirement');
    }
  };

  // ========== UTILITY FUNCTIONS ==========
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getActionBadgeColor = (action) => {
    if (action.includes('CREATED') || action.includes('GENERATED')) {
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
    } else if (action.includes('DELETED')) {
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
    } else if (action.includes('UPDATED')) {
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400';
    }
    return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  };

  // --------------------- FULLY RESPONSIVE UI (ONLY UI CHANGES) ---------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 overflow-x-hidden">
      
      {/* ✅ RESPONSIVE NAVBAR – stacks on mobile, compact */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <Shield className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" size={28} />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 truncate">
                Admin Dashboard
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400 hidden sm:block">
                System Management
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 flex-wrap">
            <DarkModeToggle />
            <span className="text-sm text-gray-600 dark:text-gray-400 hidden md:inline">
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="bg-red-600 dark:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm hover:bg-red-700 dark:hover:bg-red-600 transition-colors whitespace-nowrap"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* ✅ RESPONSIVE STATS CARDS – responsive grid, smaller padding/icons on mobile */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Total Students</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.totalStudents}</p>
              </div>
              <Users className="text-indigo-600 dark:text-indigo-400" size={32} />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Departments</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.totalDepartments}</p>
              </div>
              <Activity className="text-blue-600 dark:text-blue-400" size={32} />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.pendingApprovals}</p>
              </div>
              <Clock className="text-amber-600 dark:text-amber-400" size={32} />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Completed</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{stats.completedClearances}</p>
              </div>
              <CheckCircle className="text-green-600 dark:text-green-400" size={32} />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Active Tokens</p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {tokens.filter(t => !t.used && new Date(t.expiresAt) > new Date()).length}
                </p>
              </div>
              <Key className="text-purple-600 dark:text-purple-400" size={32} />
            </div>
          </div>
        </div>

        {/* ✅ RESPONSIVE TABS – scrollable on mobile, smaller gap/padding */}
        <div className="flex gap-2 sm:gap-4 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
              activeTab === 'overview'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Activity size={16} className="inline mr-1 sm:mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
              activeTab === 'tokens'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Key size={16} className="inline mr-1 sm:mr-2" />
            Access Tokens
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
              activeTab === 'requirements'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <FileText size={16} className="inline mr-1 sm:mr-2" />
            Requirements
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
              activeTab === 'users'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Users size={16} className="inline mr-1 sm:mr-2" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('studentStatus')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
              activeTab === 'studentStatus'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Users size={16} className="inline mr-1 sm:mr-2" />
            Student Status
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
              activeTab === 'audit'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <History size={16} className="inline mr-1 sm:mr-2" />
            Audit Trail
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm sm:text-base ${
              activeTab === 'backup'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Database size={16} className="inline mr-1 sm:mr-2" />
            Backup
          </button>
        </div>

        {/* ========== OVERVIEW TAB ========== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 sm:p-6 transition-colors duration-300">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">System Overview</h2>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 py-2">
                  <h3 className="font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-100">System Health: Good</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">All services running normally</p>
                </div>
                <div className="border-l-4 border-green-500 dark:border-green-400 pl-4 py-2">
                  <h3 className="font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-100">Database Status: Active</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Firestore connected successfully</p>
                </div>
                <div className="border-l-4 border-amber-500 dark:border-amber-400 pl-4 py-2">
                  <h3 className="font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-100">Pending Reviews: {stats.pendingApprovals}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Clearances waiting for department approval</p>
                </div>
              </div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" size={24} />
                <h3 className="text-lg sm:text-xl font-bold text-indigo-800 dark:text-indigo-300">⏳ Daily Quota Reset Timer</h3>
              </div>
              <p className="text-xs sm:text-sm text-indigo-700 dark:text-indigo-400 mb-4">
                Firestore free tier resets daily at <strong>midnight Pacific Time</strong>.
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-5 border border-indigo-200 dark:border-indigo-800">
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">⏱️ Time until next quota reset:</p>
                <p className="text-2xl sm:text-3xl font-mono font-bold text-indigo-600 dark:text-indigo-400">{timeUntilReset}</p>
                {quotaExceeded && (
                  <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-semibold mt-2">
                    ⚠️ Quota currently exceeded – blocked from writes until reset.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========== TOKENS TAB – responsive table ========== */}
        {activeTab === 'tokens' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 sm:p-6 transition-colors duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Department Access Tokens</h2>
              <button
                onClick={() => setShowTokenModal(true)}
                className="w-full sm:w-auto bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
              >
                <Plus size={18} />
                Generate Token
              </button>
            </div>
            <div className="overflow-x-auto -mx-5 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-5 sm:px-0">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Token</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Department</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Expires</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {tokens.map(token => {
                      const isExpired = new Date(token.expiresAt) < new Date();
                      const deptName = departments.find(d => d.id === token.department)?.name;
                      const expiryDate = new Date(token.expiresAt);
                      return (
                        <tr key={token.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-3 sm:px-6 py-4 font-mono text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate max-w-[120px] sm:max-w-none">
                            {token.token}
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{deptName}</td>
                          <td className="px-3 sm:px-6 py-4 text-sm hidden sm:table-cell">
                            <div className="text-gray-900 dark:text-gray-100">{expiryDate.toLocaleDateString()}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{expiryDate.toLocaleTimeString()}</div>
                          </td>
                          <td className="px-3 sm:px-6 py-4">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              token.used
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                : isExpired
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                  : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                            }`}>
                              {token.used ? 'Used' : isExpired ? 'Expired' : 'Active'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-4">
                            <button
                              onClick={() => deleteToken(token.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========== REQUIREMENTS TAB – responsive ========== */}
        {activeTab === 'requirements' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 sm:p-6 transition-colors duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Requirements Management</h2>
              <button
                onClick={() => setShowRequirementModal(true)}
                className="w-full sm:w-auto bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
              >
                <Plus size={18} />
                Add Requirement
              </button>
            </div>
            <div className="space-y-4">
              {departments.map(dept => {
                const deptReqs = requirements.filter(r => r.department === dept.id);
                return (
                  <div key={dept.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="font-bold text-base sm:text-lg mb-3 text-gray-800 dark:text-gray-100">{dept.name}</h3>
                    {deptReqs.length === 0 ? (
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic">No requirements set</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {deptReqs.map(req => (
                          <div key={req.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm sm:text-base break-words">
                                {req.title}
                              </p>
                              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
                                {req.description}
                              </p>
                              <span className={`inline-block px-2 py-1 mt-1 text-xs font-medium rounded-full ${
                                req.required
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                              }`}>
                                {req.required ? 'Required' : 'Optional'}
                              </span>
                            </div>
                            <div className="flex gap-2 ml-2 flex-shrink-0">
                              <button
                                onClick={() => editRequirement(req)}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => deleteRequirement(req.id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                              >
                                <Trash2 size={18} />
                              </button>
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

        {/* ========== USERS TAB – responsive table ========== */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 sm:p-6 transition-colors duration-300">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Registered Users</h2>
            <div className="overflow-x-auto -mx-5 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-5 sm:px-0">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Email</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{u.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">{u.email}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 hidden sm:table-cell">
                          {u.email}
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.role === 'admin'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
                              : u.role === 'student'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========== STUDENT STATUS TAB – already responsive, minor adjustments ========== */}
        {activeTab === 'studentStatus' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 sm:p-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                Student Clearance Status
              </h2>
              <button
                onClick={fetchStudentClearances}
                disabled={loadingStudents}
                className="w-full sm:w-auto bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
              >
                <Activity size={18} />
                {loadingStudents ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {/* Bulk Semester Update Card */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 text-base sm:text-lg">
                📚 Bulk Semester Update
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3">
                Set the semester for ALL students at once. This will overwrite existing semester values in both student profiles and user records.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <select
                  value={bulkSemester}
                  onChange={(e) => setBulkSemester(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm"
                >
                  <option value="">Select Semester</option>
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                  <option value="Summer">Summer</option>
                </select>
                <button
                  onClick={handleBulkSemesterUpdate}
                  disabled={!bulkSemester || bulkUpdating}
                  className="w-full sm:w-auto bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  {bulkUpdating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Update All Students
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, ID, course, section..."
                className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X size={18} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
                </button>
              )}
            </div>

            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
              Showing {filteredStudents.length} of {studentClearances.length} students
            </p>

            {loadingStudents ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-5 sm:px-0">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student</th>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden xs:table-cell">ID</th>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Course/Year/Section</th>
                        {departments.map(dept => (
                          <th key={dept.id} className="px-1 sm:px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase" title={dept.name}>
                            <span className="hidden sm:inline">{dept.name}</span>
                            <span className="sm:hidden">{dept.name.charAt(0)}</span>
                          </th>
                        ))}
                        <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={10 + departments.length} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            No students found.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student) => (
                          <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-3 sm:px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{student.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 xs:hidden">{student.studentId || '—'}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 md:hidden">
                                {student.course || '—'} · {student.yearLevel || '—'} · Sec {student.section || '—'}
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-gray-900 dark:text-gray-100 font-mono text-xs hidden xs:table-cell">
                              {student.studentId || '—'}
                            </td>
                            <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                              <div className="text-gray-900 dark:text-gray-100 text-xs">{student.course || '—'}</div>
                              <div className="text-gray-500 dark:text-gray-400 text-xs">
                                {student.yearLevel || '—'} · {student.semester || '—'} · Sec {student.section || '—'}
                              </div>
                            </td>
                            {departments.map(dept => {
                              const status = student.deptStatuses?.[dept.id]?.status || 'not_submitted';
                              let badgeColor = 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
                              let badgeText = '○';
                              if (status === 'approved') {
                                badgeColor = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
                                badgeText = '✓';
                              } else if (status === 'pending') {
                                badgeColor = 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400';
                                badgeText = '⏳';
                              } else if (status === 'rejected') {
                                badgeColor = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
                                badgeText = '✗';
                              }
                              return (
                                <td key={dept.id} className="px-1 sm:px-2 py-3 text-center">
                                  <span className={`inline-block px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs font-semibold ${badgeColor}`} title={status}>
                                    <span className="hidden sm:inline">{status === 'not_submitted' ? '—' : status}</span>
                                    <span className="sm:hidden">{badgeText}</span>
                                  </span>
                                </td>
                              );
                            })}
                            <td className="px-3 sm:px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {student.summary?.approved || 0}/{student.summary?.total || 7}
                                </span>
                                <div className="w-12 sm:w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-600 dark:bg-indigo-500"
                                    style={{ width: `${((student.summary?.approved || 0) / 7) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== AUDIT TRAIL TAB – responsive ========== */}
        {activeTab === 'audit' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 sm:p-6 transition-colors duration-300">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Audit Trail</h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">Showing last 50 admin actions</p>
            {auditLogs.length === 0 ? (
              <div className="text-center py-12">
                <History className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={40} />
                <p className="text-sm text-gray-500 dark:text-gray-400">No audit logs yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map(log => (
                  <div key={log.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold self-start ${getActionBadgeColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-2">
                      <strong>Performed by:</strong> {log.performedBy}
                    </p>
                    {log.details && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-700 p-2 rounded break-words">
                        {Object.entries(log.details).map(([key, value]) => (
                          <div key={key}>
                            <strong>{key}:</strong> {value}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== BACKUP & RECOVERY TAB – responsive ========== */}
        {activeTab === 'backup' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Backup & Recovery</h2>
              <div className="flex flex-col xs:flex-row gap-3 w-full sm:w-auto">
                <button
                  onClick={handleExportBackup}
                  disabled={backupLoading}
                  className="w-full xs:w-auto bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  <Download size={18} />
                  {backupLoading ? 'Exporting...' : 'Export Backup'}
                </button>
                <label className="w-full xs:w-auto bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-700 dark:hover:bg-green-600 flex items-center justify-center gap-2 cursor-pointer text-sm">
                  <Upload size={18} />
                  Restore Backup
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportBackup}
                    disabled={restoreLoading}
                  />
                </label>
              </div>
            </div>

            {backupMessage && (
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
                backupMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}>
                {backupMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span className="break-words">{backupMessage.text}</span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="font-semibold text-base sm:text-lg mb-3 text-gray-800 dark:text-gray-200">Select Collections to Backup</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                {collectionList.map(col => (
                  <label key={col} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer text-xs sm:text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCollections.includes(col)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCollections([...selectedCollections, col]);
                        } else {
                          setSelectedCollections(selectedCollections.filter(c => c !== col));
                        }
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300 truncate">{col}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setSelectedCollections(collectionList)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                  Select All
                </button>
                <button onClick={() => setSelectedCollections([])} className="text-xs text-gray-600 dark:text-gray-400 hover:underline">
                  Clear All
                </button>
              </div>
            </div>

            {/* Danger Zone – Total Cleaner */}
            <div className="mt-8 border-t-2 border-red-200 dark:border-red-800 pt-6">
              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={24} />
                  <h3 className="text-base sm:text-lg font-bold text-red-800 dark:text-red-300">⚠️ Danger Zone – Total Cleaner</h3>
                </div>
                <p className="text-xs sm:text-sm text-red-700 dark:text-red-400 mb-4">
                  This will <strong>permanently delete ALL documents</strong> from the selected collections below.
                  Use only to test backup & restore functionality.
                </p>
                <div className="mb-4">
                  <label className="block text-xs sm:text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                    Confirm by typing <span className="font-mono bg-red-100 dark:bg-red-800 px-2 py-1 rounded">DELETE</span>:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="w-full md:w-64 px-4 py-2 text-sm border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleClearCollections}
                  disabled={deleteConfirmText !== 'DELETE' || clearLoading}
                  className="w-full md:w-auto bg-red-600 dark:bg-red-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  {clearLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 size={20} />
                      DELETE SELECTED COLLECTIONS
                    </>
                  )}
                </button>
                <p className="text-xs text-red-600 dark:text-red-400 mt-4">
                  ⚠️ This action cannot be undone. Make sure you have a backup file ready to restore.
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-400">
                <strong>📌 How it works:</strong><br />
                • <strong>Export:</strong> Downloads a JSON file containing all documents from selected collections.<br />
                • <strong>Restore:</strong> Upload a previously exported JSON file to restore data. <span className="font-bold">Existing documents with same ID will be overwritten.</span><br />
                • This backup is stored <strong>locally on your computer</strong> – no cloud storage costs.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ✅ RESPONSIVE TOKEN GENERATION MODAL */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-sm sm:max-w-md w-full p-5 sm:p-6 transition-colors duration-300 shadow-xl">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Generate Access Token</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
                <select
                  value={newToken.department}
                  onChange={(e) => setNewToken({ ...newToken, department: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Expires In (days)</label>
                <input
                  type="number"
                  value={newToken.expiresIn}
                  onChange={(e) => setNewToken({ ...newToken, expiresIn: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg"
                  min="1"
                  max="365"
                />
              </div>
              <div className="flex flex-col xs:flex-row gap-3 mt-6">
                <button
                  onClick={generateToken}
                  className="flex-1 bg-indigo-600 dark:bg-indigo-500 text-white py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors text-sm"
                >
                  Generate
                </button>
                <button
                  onClick={() => setShowTokenModal(false)}
                  className="flex-1 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ RESPONSIVE REQUIREMENT MODAL */}
      {showRequirementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-sm sm:max-w-md w-full p-5 sm:p-6 transition-colors duration-300 shadow-xl">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              {editingRequirement ? 'Edit Requirement' : 'Add Requirement'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
                <select
                  value={newRequirement.department}
                  onChange={(e) => setNewRequirement({ ...newRequirement, department: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={newRequirement.title}
                  onChange={(e) => setNewRequirement({ ...newRequirement, title: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg"
                  placeholder="e.g., No Pending Books"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={newRequirement.description}
                  onChange={(e) => setNewRequirement({ ...newRequirement, description: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg"
                  rows="3"
                  placeholder="Describe what the student needs to submit..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newRequirement.required}
                  onChange={(e) => setNewRequirement({ ...newRequirement, required: e.target.checked })}
                  id="required-check"
                  className="w-4 h-4"
                />
                <label htmlFor="required-check" className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  Required (mandatory for clearance)
                </label>
              </div>
              <div className="flex flex-col xs:flex-row gap-3 mt-6">
                <button
                  onClick={saveRequirement}
                  className="flex-1 bg-indigo-600 dark:bg-indigo-500 text-white py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors text-sm"
                >
                  {editingRequirement ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setShowRequirementModal(false);
                    setEditingRequirement(null);
                    setNewRequirement({
                      department: 'library',
                      title: '',
                      description: '',
                      required: true
                    });
                  }}
                  className="flex-1 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}