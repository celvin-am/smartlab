import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Bell, User, X, PanelLeft } from 'lucide-react'
import { getAuth, signOut } from 'firebase/auth'

const Header = ({ isSidebarOpen, onToggleSidebar }) => {
  const navigate = useNavigate()
  const auth = getAuth()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const handleLogout = async () => {
    try {
      await signOut(auth)
      sessionStorage.removeItem('labaccess_role')
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
      sessionStorage.removeItem('labaccess_role')
      navigate('/login')
    }
  }

  return (
    <div className="glass sticky top-0 z-50 border-b border-blue-100">
      <div className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 flex items-center justify-between">
        {/* Left Section - Logo */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border border-blue-200 bg-white/70 text-blue-700 hover:bg-blue-50 transition-colors flex items-center justify-center flex-shrink-0"
            aria-label={isSidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
            title={isSidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
          >
            <PanelLeft size={18} className="sm:w-5 sm:h-5" />
          </button>
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
            <div className="relative group flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-lg blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
              <img 
                src="/uny-logo.png" 
                alt="Logo UNY" 
                className="h-10 w-10 sm:h-12 sm:w-12 relative group-hover:scale-110 transition-transform duration-300"
                style={{ width: 'auto', height: 'auto', maxWidth: '48px', maxHeight: '48px' }}
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            </div>
            <div className="border-l-2 border-blue-200 pl-2 sm:pl-3 md:pl-4 block">
              <h1 className="text-sm sm:text-base md:text-lg font-bold gradient-text truncate">Smart Lab Access</h1>
            </div>
          </div>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-6">
          {/* Notification Bell */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications)
                setShowProfile(false)
              }}
              className="relative text-gray-600 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-blue-50 active:bg-blue-100 flex-shrink-0"
            >
              <Bell size={20} className="sm:w-5 sm:h-5 hover:scale-110 transition-transform" />
              <span className="absolute top-0.5 right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full animate-pulse"></span>
            </button>
            
            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-12 sm:top-14 w-64 sm:w-72 glass rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-4 border border-blue-100 animate-slideInDown max-h-80 overflow-y-auto">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-800">📬 Notifikasi</h3>
                  <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                    <X size={16} className="sm:w-5 sm:h-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg hover:from-blue-100 hover:to-blue-150 transition-all cursor-pointer border-l-4 border-blue-500">
                    <p className="text-xs sm:text-sm font-semibold text-gray-800">📦 Peminjaman Baru</p>
                    <p className="text-xs text-gray-600 mt-1">Ada 2 permintaan peminjaman baru</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg hover:from-yellow-100 hover:to-yellow-150 transition-all cursor-pointer border-l-4 border-yellow-500">
                    <p className="text-xs sm:text-sm font-semibold text-gray-800">⏰ Pengingat Pengembalian</p>
                    <p className="text-xs text-gray-600 mt-1">1 item akan jatuh tempo besok</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg hover:from-green-100 hover:to-green-150 transition-all cursor-pointer border-l-4 border-green-500">
                    <p className="text-xs sm:text-sm font-semibold text-gray-800">✅ Persetujuan Pengembalian</p>
                    <p className="text-xs text-gray-600 mt-1">3 pengembalian telah disetujui</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowProfile(!showProfile)
                setShowNotifications(false)
              }}
              className="relative text-gray-600 hover:text-blue-600 transition-colors group flex-shrink-0"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-xs sm:text-sm group-hover:shadow-lg group-hover:scale-110 transition-all duration-300 shadow-md">
                AD
              </div>
            </button>
            
            {/* Profile Dropdown */}
            {showProfile && (
              <div className="absolute right-0 top-12 sm:top-14 w-48 sm:w-56 glass rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden border border-blue-100 animate-slideInDown">
                <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                  <p className="font-bold text-gray-800 text-sm">Admin User</p>
                  <p className="text-xs text-gray-600 mt-1">admin@uny.ac.id</p>
                </div>
                <button className="w-full px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm text-gray-700 hover:bg-blue-50 font-medium flex items-center gap-2 sm:gap-3 transition-colors group">
                  <User size={16} className="sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" /> 
                  <span className="group-hover:translate-x-1 transition-transform truncate">Profil Saya</span>
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm text-red-600 hover:bg-red-50 font-bold flex items-center gap-2 sm:gap-3 border-t border-blue-100 transition-colors group"
                >
                  <LogOut size={16} className="sm:w-5 sm:h-5 flex-shrink-0" /> 
                  <span className="group-hover:translate-x-1 transition-transform truncate">Keluar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animated Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent"></div>
    </div>
  )
}

export default Header
