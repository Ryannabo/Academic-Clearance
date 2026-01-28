// src/components/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  Users, Activity, CheckCircle, Clock, AlertCircle, Key,
  Settings, FileText, Trash2, Plus, Edit2, Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
  where
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

  // NEW: Clear all Student IDs function
  const clearAllStudentIds = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL Student ID registrations.\n\nAre you absolutely sure?')) {
      return;
    }

    try {
      console.log('🗑️ Clearing student_ids collection...');

      const studentIdsSnapshot = await getDocs(collection(db, 'student_ids'));

      console.log(`Found ${studentIdsSnapshot.size} Student IDs to delete`);

      if (studentIdsSnapshot.size === 0) {
        alert('✅ No Student IDs found. Collection is already empty.');
        return;
      }

      const deletePromises = studentIdsSnapshot.docs.map(docSnap =>
        deleteDoc(doc(db, 'student_ids', docSnap.id))
      );

      await Promise.all(deletePromises);

      console.log('✅ All Student IDs cleared!');
      alert(`✅ Successfully deleted ${studentIdsSnapshot.size} Student ID registrations.\n\nUsers can now sign up with any Student ID.`);

    } catch (error) {
      console.error('❌ Error clearing Student IDs:', error);
      alert('❌ Error: ' + error.message);
    }
  };

  useEffect(() => {
    // Load admin utilities in browser console
    import('../utils/AdminFixes').then(() => {
      console.log('🔧 Admin utilities loaded!');
    });
  }, []);

  useEffect(() => {
    // Fetch statistics
    const fetchStats = async () => {
      try {
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const clearancesSnapshot = await getDocs(collection(db, 'clearances'));
        const requirementsSnapshot = await getDocs(collection(db, 'clearance_requirements'));

        const pending = requirementsSnapshot.docs.filter(
          doc => doc.data().status === 'pending'
        ).length;

        const completed = clearancesSnapshot.docs.filter(
          doc => doc.data().status === 'completed'
        ).length;

        setStats({
          totalStudents: studentsSnapshot.size,
          totalClearances: clearancesSnapshot.size,
          pendingApprovals: pending,
          completedClearances: completed,
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
      await deleteDoc(doc(db, 'department_tokens', tokenId));
      alert('Token deleted successfully');
    } catch (error) {
      console.error('Error deleting token:', error);
      alert('Failed to delete token');
    }
  };

  const saveRequirement = async () => {
    try {
      if (editingRequirement) {
        await updateDoc(doc(db, 'requirements_templates', editingRequirement.id), {
          ...newRequirement,
          updatedAt: new Date().toISOString()
        });
        alert('Requirement updated successfully');
      } else {
        await addDoc(collection(db, 'requirements_templates'), {
          ...newRequirement,
          createdAt: new Date().toISOString()
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
      await deleteDoc(doc(db, 'requirements_templates', reqId));
      alert('Requirement deleted successfully');
    } catch (error) {
      console.error('Error deleting requirement:', error);
      alert('Failed to delete requirement');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="text-indigo-600" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-indigo-600">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">System Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
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
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Students</p>
                <p className="text-3xl font-bold text-gray-800">{stats.totalStudents}</p>
              </div>
              <Users className="text-indigo-600" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Departments</p>
                <p className="text-3xl font-bold text-gray-800">{stats.totalDepartments}</p>
              </div>
              <Activity className="text-blue-600" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{stats.pendingApprovals}</p>
              </div>
              <Clock className="text-amber-600" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completedClearances}</p>
              </div>
              <CheckCircle className="text-green-600" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Tokens</p>
                <p className="text-3xl font-bold text-purple-600">
                  {tokens.filter(t => !t.used && new Date(t.expiresAt) > new Date()).length}
                </p>
              </div>
              <Key className="text-purple-600" size={40} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'
              }`}
          >
            <Activity size={18} className="inline mr-2" />
            Overview
          </button>
          {/* NEW: Cleanup Section */}
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
              <div className="flex-1">
                <h3 className="font-bold text-lg text-red-800 mb-2">🔧 System Maintenance</h3>
                <p className="text-sm text-red-700 mb-3">
                  If you cleared the students collection and users can't sign up because "Student ID already used",
                  click this button to clear the Student ID registry.
                </p>
                <button
                  onClick={clearAllStudentIds}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-semibold flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Clear All Student IDs
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'tokens' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'
              }`}
          >
            <Key size={18} className="inline mr-2" />
            Access Tokens
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'requirements' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'
              }`}
          >
            <FileText size={18} className="inline mr-2" />
            Requirements
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'
              }`}
          >
            <Users size={18} className="inline mr-2" />
            Users
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">System Overview</h2>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <h3 className="font-semibold text-lg">System Health: Good</h3>
                <p className="text-sm text-gray-600">All services running normally</p>
              </div>
              <div className="border-l-4 border-green-500 pl-4 py-2">
                <h3 className="font-semibold text-lg">Database Status: Active</h3>
                <p className="text-sm text-gray-600">Firestore connected successfully</p>
              </div>
              <div className="border-l-4 border-amber-500 pl-4 py-2">
                <h3 className="font-semibold text-lg">Pending Reviews: {stats.pendingApprovals}</h3>
                <p className="text-sm text-gray-600">Clearances waiting for department approval</p>
              </div>
            </div>
          </div>
        )}

        {/* Tokens Tab */}
        {activeTab === 'tokens' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Department Access Tokens</h2>
              <button
                onClick={() => setShowTokenModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Plus size={20} />
                Generate Token
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tokens.map(token => {
                    const isExpired = new Date(token.expiresAt) < new Date();
                    const deptName = departments.find(d => d.id === token.department)?.name;
                    const expiryDate = new Date(token.expiresAt);
                    const createdDate = token.createdAt ? new Date(token.createdAt) : null;

                    return (
                      <tr key={token.id}>
                        <td className="px-6 py-4 font-mono text-sm">{token.token}</td>
                        <td className="px-6 py-4">{deptName}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium">{expiryDate.toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500">{expiryDate.toLocaleTimeString()}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${token.used ? 'bg-gray-100 text-gray-800' :
                            isExpired ? 'bg-red-100 text-red-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                            {token.used ? 'Used' : isExpired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => deleteToken(token.id)}
                            className="text-red-600 hover:text-red-800"
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
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Requirements Management</h2>
              <button
                onClick={() => setShowRequirementModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Plus size={20} />
                Add Requirement
              </button>
            </div>

            <div className="space-y-4">
              {departments.map(dept => {
                const deptReqs = requirements.filter(r => r.department === dept.id);
                return (
                  <div key={dept.id} className="border rounded-lg p-4">
                    <h3 className="font-bold text-lg mb-3">{dept.name}</h3>
                    {deptReqs.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No requirements set</p>
                    ) : (
                      <div className="space-y-2">
                        {deptReqs.map(req => (
                          <div key={req.id} className="flex items-start justify-between p-3 bg-gray-50 rounded">
                            <div className="flex-1">
                              <p className="font-semibold">{req.title}</p>
                              <p className="text-sm text-gray-600">{req.description}</p>
                              <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${req.required ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                {req.required ? 'Required' : 'Optional'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => editRequirement(req)}
                                className="text-indigo-600 hover:text-indigo-800"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => deleteRequirement(req.id)}
                                className="text-red-600 hover:text-red-800"
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
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">Registered Users</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="px-6 py-4">{u.name}</td>
                      <td className="px-6 py-4">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          u.role === 'student' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Token Generation Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Generate Access Token</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={newToken.department}
                  onChange={(e) => setNewToken({ ...newToken, department: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expires In (days)</label>
                <input
                  type="number"
                  value={newToken.expiresIn}
                  onChange={(e) => setNewToken({ ...newToken, expiresIn: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  min="1"
                  max="365"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={generateToken}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                >
                  Generate
                </button>
                <button
                  onClick={() => setShowTokenModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">
              {editingRequirement ? 'Edit Requirement' : 'Add Requirement'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={newRequirement.department}
                  onChange={(e) => setNewRequirement({ ...newRequirement, department: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={newRequirement.title}
                  onChange={(e) => setNewRequirement({ ...newRequirement, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., No Pending Books"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newRequirement.description}
                  onChange={(e) => setNewRequirement({ ...newRequirement, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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
                />
                <label htmlFor="required-check" className="text-sm font-medium text-gray-700">
                  Required (mandatory for clearance)
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveRequirement}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
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
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
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