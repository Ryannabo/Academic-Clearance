// src/components/AdminDashboard.jsx (WITH DARK MODE + AUDIT TRAIL)
import React, { useState, useEffect } from 'react';
import {
  Users, Activity, CheckCircle, Clock, AlertCircle, Key,
  Settings, FileText, Trash2, Plus, Edit2, Shield, History,
  Database, Download, Upload
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
    'student_ids'
  ]);

  // Total Cleaner state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [clearLoading, setClearLoading] = useState(false);

  // Audit Trail Function
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

  useEffect(() => {
    // Fetch statistics
    const fetchStats = async () => {
      try {
        // 1. Total students – top-level collection (✅ allowed)
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const totalStudents = studentsSnapshot.size;

        // 2. Total clearances – top-level collection (✅ allowed)
        const clearancesSnapshot = await getDocs(collection(db, 'clearances'));
        const totalClearances = clearancesSnapshot.size;

        // 3. Pending approvals – loop through each department (✅ now allowed)
        let pendingCount = 0;
        for (const dept of departments) {
          try {
            const requirementsRef = collection(db, 'clearance_requirements', dept.id, 'students');
            const snapshot = await getDocs(requirementsRef);
            pendingCount += snapshot.docs.filter(doc => doc.data().status === 'pending').length;
          } catch (deptError) {
            console.warn(`Could not fetch requirements for ${dept.name}:`, deptError);
            // Continue with other departments even if one fails
          }
        }

        // 4. Completed clearances – from clearances collection
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

    // Subscribe to tokens
    const tokensQuery = query(collection(db, 'department_tokens'));
    const unsubscribeTokens = onSnapshot(tokensQuery, (snapshot) => {
      const tokensList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTokens(tokensList);
    });

    // Subscribe to requirements templates
    const requirementsQuery = query(collection(db, 'requirements_templates'));
    const unsubscribeReqs = onSnapshot(requirementsQuery, (snapshot) => {
      const reqsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequirements(reqsList);
    });

    // Subscribe to audit logs (last 50)
    const auditQuery = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const unsubscribeAudit = onSnapshot(auditQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAuditLogs(logs);
    });

    // Fetch users
    const fetchUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    };

    fetchUsers();

    return () => {
      unsubscribeTokens();
      unsubscribeReqs();
      unsubscribeAudit();
    };
  }, []);

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

      // Log audit event
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

      // Log audit event
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

  // ========== BACKUP & RECOVERY HANDLERS (FIXED PERMISSIONS) ==========

  // ✅ Only collections that admin can read (top-level)
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
          // Permission denied or collection doesn't exist – skip it
          console.warn(`⚠️ Skipping ${collectionName}: ${error.message}`);
          skippedCollections.push(collectionName);
        }
      }

      if (Object.keys(backupData).length === 0) {
        throw new Error('No collections could be read. Check permissions.');
      }

      // Add metadata
      backupData._metadata = {
        exportedAt: new Date().toISOString(),
        exportedBy: user?.email,
        collections: Object.keys(backupData).filter(k => k !== '_metadata'),
        version: '1.0'
      };

      // Create and download JSON file
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

      setBackupMessage({
        type: 'success',
        text: successMessage + warningMessage
      });

      // Log audit event
      await logAuditEvent('BACKUP_EXPORTED', {
        collections: Object.keys(backupData).filter(k => k !== '_metadata'),
        skipped: skippedCollections,
        documentCounts: Object.fromEntries(
          Object.keys(backupData)
            .filter(k => k !== '_metadata')
            .map(col => [col, backupData[col]?.length || 0])
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
          await setDoc(docRef, data); // ✅ setDoc must be imported
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

  // ========== TOTAL CLEANER – ULTRA THROTTLED FOR SPARK ==========
  const handleClearCollections = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    if (selectedCollections.length === 0) {
      alert('Please select at least one collection to clear.');
      return;
    }

    // 🛡️ VERIFY ADMIN STATUS FIRST
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
      alert('❌ Admin verification failed. Cannot delete.');
      return;
    }

    const reallySure = window.confirm(
      `🔥 FINAL WARNING: You are about to delete ALL documents from:\n\n` +
      selectedCollections.join(', ') +
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
      const BATCH_SIZE = 20;        // 🔥 Tiny batches
      const DELAY_MS = 3000;        // 🔥 3 seconds between batches

      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      for (const collectionName of selectedCollections) {
        try {
          console.log(`🔄 Clearing ${collectionName}...`);
          const snapshot = await getDocs(collection(db, collectionName));
          const docs = snapshot.docs;

          if (docs.length === 0) continue;

          for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const batchDocs = docs.slice(i, i + BATCH_SIZE);
            batchDocs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            totalDeleted += batchDocs.length;

            console.log(`  ✅ Deleted ${totalDeleted} / ${docs.length} from ${collectionName}`);

            // ⏳ Wait before next batch
            if (i + BATCH_SIZE < docs.length) {
              await sleep(DELAY_MS);
            }
          }
        } catch (error) {
          if (error.code === 'resource-exhausted') {
            alert(`❌ Quota exceeded! Stopped at ${totalDeleted} deletions.\nUpgrade to Blaze plan or wait 24h.`);
            break;
          }
          if (error.code === 'permission-denied') {
            console.warn(`⚠️ Permission denied for ${collectionName} – skipping.`);
            failedCollections.push(collectionName);
          } else {
            console.error(`Failed to clear ${collectionName}:`, error);
            failedCollections.push(collectionName);
          }
        }
      }

      await logAuditEvent('TOTAL_CLEANER_EXECUTED', {
        collections: selectedCollections.filter(c => !failedCollections.includes(c)),
        deletedCount: totalDeleted,
        failedCollections
      });

      alert(`✅ Cleared ${totalDeleted} documents.\n⚠️ Failed: ${failedCollections.join(', ') || 'none'}`);
      setDeleteConfirmText('');
      if (typeof fetchStats === 'function') fetchStats();

    } catch (error) {
      console.error('Clear error:', error);
      alert('❌ Failed: ' + error.message);
    } finally {
      setClearLoading(false);
    }
  };

  const saveRequirement = async () => {
    try {
      if (editingRequirement) {
        await updateDoc(doc(db, 'requirements_templates', editingRequirement.id), {
          ...newRequirement,
          updatedAt: new Date().toISOString()
        });

        // Log audit event
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

        // Log audit event
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

      // Log audit event
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

  {/* ========== QUOTA MONITOR ========== */ }
  {
    activeTab === 'backup' && (
      <>
        {/* ... your existing backup UI ... */}

        {/* PASTE THIS AFTER YOUR EXISTING BACKUP CONTENT */}
        {quotaExceeded && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
              <h3 className="text-lg font-bold text-red-800 dark:text-red-300">⚠️ Daily Write Quota Exhausted</h3>
            </div>
            <p className="text-sm text-red-700 dark:text-red-400 mb-3">
              You've used all 20,000 daily writes. Restore operations, OTP emails, and session creation are temporarily blocked.
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">⏳ Time until quota reset (Pacific Time):</p>
              <p className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400">{timeUntilReset}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Reset occurs daily at midnight Pacific Time. Use this timer to plan your testing.
              </p>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="text-indigo-600 dark:text-indigo-400" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">System Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <DarkModeToggle />
            <span className="text-sm text-gray-600 dark:text-gray-400">{user?.email}</span>
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
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Total Students</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.totalStudents}</p>
              </div>
              <Users className="text-indigo-600 dark:text-indigo-400" size={40} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Departments</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{stats.totalDepartments}</p>
              </div>
              <Activity className="text-blue-600 dark:text-blue-400" size={40} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Pending</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.pendingApprovals}</p>
              </div>
              <Clock className="text-amber-600 dark:text-amber-400" size={40} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Completed</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.completedClearances}</p>
              </div>
              <CheckCircle className="text-green-600 dark:text-green-400" size={40} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Active Tokens</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {tokens.filter(t => !t.used && new Date(t.expiresAt) > new Date()).length}
                </p>
              </div>
              <Key className="text-purple-600 dark:text-purple-400" size={40} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'overview'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <Activity size={18} className="inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'tokens'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <Key size={18} className="inline mr-2" />
            Access Tokens
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'requirements'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <FileText size={18} className="inline mr-2" />
            Requirements
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'users'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <Users size={18} className="inline mr-2" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'audit'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <History size={18} className="inline mr-2" />
            Audit Trail
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === 'backup'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <Database size={18} className="inline mr-2" />
            Backup & Recovery
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">System Overview</h2>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 py-2">
                <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">System Health: Good</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">All services running normally</p>
              </div>
              <div className="border-l-4 border-green-500 dark:border-green-400 pl-4 py-2">
                <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">Database Status: Active</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Firestore connected successfully</p>
              </div>
              <div className="border-l-4 border-amber-500 dark:border-amber-400 pl-4 py-2">
                <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">Pending Reviews: {stats.pendingApprovals}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Clearances waiting for department approval</p>
              </div>
            </div>
          </div>
        )}

        {/* Tokens Tab */}
        {activeTab === 'tokens' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Department Access Tokens</h2>
              <button
                onClick={() => setShowTokenModal(true)}
                className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 flex items-center gap-2 transition-colors"
              >
                <Plus size={20} />
                Generate Token
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 transition-colors duration-300">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Token</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expires</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {tokens.map(token => {
                    const isExpired = new Date(token.expiresAt) < new Date();
                    const deptName = departments.find(d => d.id === token.department)?.name;
                    const expiryDate = new Date(token.expiresAt);

                    return (
                      <tr key={token.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm text-gray-900 dark:text-gray-100">{token.token}</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{deptName}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{expiryDate.toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{expiryDate.toLocaleTimeString()}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${token.used
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                            : isExpired
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                            }`}>
                            {token.used ? 'Used' : isExpired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
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
        )}

        {/* Requirements Tab */}
        {activeTab === 'requirements' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Requirements Management</h2>
              <button
                onClick={() => setShowRequirementModal(true)}
                className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 flex items-center gap-2 transition-colors"
              >
                <Plus size={20} />
                Add Requirement
              </button>
            </div>

            <div className="space-y-4">
              {departments.map(dept => {
                const deptReqs = requirements.filter(r => r.department === dept.id);
                return (
                  <div key={dept.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-colors duration-300">
                    <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">{dept.name}</h3>
                    {deptReqs.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">No requirements set</p>
                    ) : (
                      <div className="space-y-2">
                        {deptReqs.map(req => (
                          <div key={req.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded transition-colors duration-300">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 dark:text-gray-100">{req.title}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{req.description}</p>
                              <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${req.required
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                                }`}>
                                {req.required ? 'Required' : 'Optional'}
                              </span>
                            </div>
                            <div className="flex gap-2">
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

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Registered Users</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 transition-colors duration-300">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{u.name}</td>
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${u.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
                          : u.role === 'student'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeTab === 'audit' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-300">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Audit Trail</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Showing last 50 admin actions</p>

            {auditLogs.length === 0 ? (
              <div className="text-center py-12">
                <History className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={48} />
                <p className="text-gray-500 dark:text-gray-400">No audit logs yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map(log => (
                  <div key={log.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionBadgeColor(log.action)}`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>Performed by:</strong> {log.performedBy}
                        </p>
                        {log.details && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                            {Object.entries(log.details).map(([key, value]) => (
                              <div key={key}>
                                <strong>{key}:</strong> {value}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Token Generation Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 transition-colors duration-300">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Generate Access Token</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
                <select
                  value={newToken.department}
                  onChange={(e) => setNewToken({ ...newToken, department: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors duration-300"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Expires In (days)</label>
                <input
                  type="number"
                  value={newToken.expiresIn}
                  onChange={(e) => setNewToken({ ...newToken, expiresIn: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors duration-300"
                  min="1"
                  max="365"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={generateToken}
                  className="flex-1 bg-indigo-600 dark:bg-indigo-500 text-white py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
                >
                  Generate
                </button>
                <button
                  onClick={() => setShowTokenModal(false)}
                  className="flex-1 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requirement Modal */}
      {showRequirementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 transition-colors duration-300">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              {editingRequirement ? 'Edit Requirement' : 'Add Requirement'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
                <select
                  value={newRequirement.department}
                  onChange={(e) => setNewRequirement({ ...newRequirement, department: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors duration-300"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={newRequirement.title}
                  onChange={(e) => setNewRequirement({ ...newRequirement, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors duration-300"
                  placeholder="e.g., No Pending Books"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={newRequirement.description}
                  onChange={(e) => setNewRequirement({ ...newRequirement, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg transition-colors duration-300"
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
                <label htmlFor="required-check" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Required (mandatory for clearance)
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveRequirement}
                  className="flex-1 bg-indigo-600 dark:bg-indigo-500 text-white py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
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
                  className="flex-1 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}{/* ========== BACKUP & RECOVERY TAB ========== */}
      {activeTab === 'backup' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Backup & Recovery</h2>
            <div className="flex gap-3">
              <button
                onClick={handleExportBackup}
                disabled={backupLoading}
                className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 flex items-center gap-2 disabled:opacity-50"
              >
                <Download size={18} />
                {backupLoading ? 'Exporting...' : 'Export Backup'}
              </button>
              <label className="bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-2 cursor-pointer">
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

          {/* Status messages */}
          {backupMessage && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${backupMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}>
              {backupMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              {backupMessage.text}
            </div>
          )}

          {/* Collection selector */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-3 text-gray-800 dark:text-gray-200">Select Collections to Backup</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {collectionList.map(col => (
                <label key={col} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
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
                  <span className="text-sm text-gray-700 dark:text-gray-300">{col}</span>
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

          {/* ===== DANGER ZONE – TOTAL CLEANER ===== */}
          <div className="mt-8 border-t-2 border-red-200 dark:border-red-800 pt-6">
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-5">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
                <h3 className="text-lg font-bold text-red-800 dark:text-red-300">⚠️ Danger Zone – Total Cleaner</h3>
              </div>

              <p className="text-sm text-red-700 dark:text-red-400 mb-4">
                This will <strong>permanently delete ALL documents</strong> from the selected collections below.
                Use only to test backup & restore functionality.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                  Confirm by typing <span className="font-mono bg-red-100 dark:bg-red-800 px-2 py-1 rounded">DELETE</span>:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full md:w-64 px-4 py-2 border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleClearCollections}
                disabled={deleteConfirmText !== 'DELETE' || clearLoading}
                className="bg-red-600 dark:bg-red-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
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
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-400">
              <strong>📌 How it works:</strong><br />
              • <strong>Export:</strong> Downloads a JSON file containing all documents from selected collections.<br />
              • <strong>Restore:</strong> Upload a previously exported JSON file to restore data. <span className="font-bold">Existing documents with same ID will be overwritten.</span><br />
              • This backup is stored <strong>locally on your computer</strong> – no cloud storage costs.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}