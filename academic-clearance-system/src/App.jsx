// src/App.jsx
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import StudentDashboard from './components/StudentDashboard';
import DepartmentDashboard from './components/DepartmentDashboard';
import AdminDashboard from './components/AdminDashboard';

function AppContent() {
  const { user, loading } = useAuth();

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

  if (!user) {
    return <Login />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard />;
  } else if (user.role === 'student') {
    return <StudentDashboard />;
  } else if (user.role?.startsWith('dept_')) {
    return <DepartmentDashboard />;
  } else {
    return <DepartmentDashboard />;
  }
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;