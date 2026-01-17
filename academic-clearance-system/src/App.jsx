// src/App.jsx
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import StudentDashboard from './components/StudentDashboard';
import DepartmentDashboard from './components/DepartmentDashboard';
import AdminDashboard from './components/AdminDashboard';

function AppContent() {
  const { user, loading } = useAuth();

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

  if (!user) {
    return <Login />;
  }

  // Determine which dashboard to show based on user role
  if (user.role === 'admin') {
    return <AdminDashboard />;
  } else if (user.role === 'student') {
    return <StudentDashboard />;
  } else if (user.role?.startsWith('dept_')) {
    // All department sub-roles start with "dept_"
    return <DepartmentDashboard />;
  } else {
    // Fallback for old users without sub-roles
    return <DepartmentDashboard />;
  }
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;