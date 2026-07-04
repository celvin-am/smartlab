import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import firebaseConfig from './firebaseConfig'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import LoginPage from './pages/LoginPage'
import AdminLoginPage from './pages/AdminLoginPage'
import StudentLoginPage from './pages/StudentLoginPage'
import DashboardPage from './pages/DashboardPage'
import BorrowersPage from './pages/BorrowersPage'
import ComponentsPage from './pages/ComponentsPage'
import EmailSettingsPage from './pages/EmailSettingsPage'
import StudentPortalPage from './pages/StudentPortalPage'

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
const auth = getAuth(app)

// Protected Route Component
function ProtectedRoute({ children, isAuthenticated, isLoading, allowedRoles = [], redirectTo = '/login' }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const role = sessionStorage.getItem('labaccess_role') || ''
  const allowsStudent = allowedRoles.includes('student')
  if (!isAuthenticated && allowsStudent && role === 'student') {
    return children
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'student' ? '/student' : '/login'} />
  }

  return children
}

function AppContent() {
  const location = useLocation()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Check authentication state on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true)
      } else {
        setIsAuthenticated(false)
      }
      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (location.pathname.startsWith('/login')) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/pengelola" element={<AdminLoginPage />} />
        <Route path="/login/mahasiswa" element={<StudentLoginPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route
        path="/student"
        element={(
          <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading} allowedRoles={['student']} redirectTo="/login/mahasiswa">
            <StudentPortalPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/*"
        element={(
          <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading} allowedRoles={['admin']} redirectTo="/login/pengelola">
            <div className="flex flex-col h-screen">
              <Header
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar
                  isOpen={isSidebarOpen}
                  onClose={() => setIsSidebarOpen(false)}
                />
                <div className="flex-1 overflow-auto">
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/borrowers" element={<BorrowersPage />} />
                    <Route path="/components" element={<ComponentsPage />} />
                    <Route path="/email-settings" element={<EmailSettingsPage />} />
                  </Routes>
                </div>
              </div>
            </div>
          </ProtectedRoute>
        )}
      />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
