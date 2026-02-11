// src/App.jsx – SIMPLIFIED, MODAL REMOVED
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import StudentDashboard from './components/StudentDashboard';
import DepartmentDashboard from './components/DepartmentDashboard';
import AdminDashboard from './components/AdminDashboard';

function AppContent() {
  const { user, loading, is2FAPending } = useAuth();

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

  // Stay on login if not authenticated OR 2FA is pending
  if (!user || is2FAPending) {
    return <Login />;
  }

  // Authenticated – show dashboard
  if (user.role === 'admin') {
    return <AdminDashboard />;
  } else if (user.role === 'student') {
    return <StudentDashboard />;
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