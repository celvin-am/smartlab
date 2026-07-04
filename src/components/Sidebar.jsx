import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Users, Package, ChevronRight, X, Mail } from 'lucide-react'

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation()

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: Home, color: 'from-blue-400 to-blue-600' },
    { path: '/borrowers', label: 'Daftar Peminjam', icon: Users, color: 'from-cyan-400 to-blue-500' },
    { path: '/components', label: 'Komponen Lab', icon: Package, color: 'from-blue-500 to-indigo-600' },
    { path: '/email-settings', label: 'Email Setting', icon: Mail, color: 'from-emerald-500 to-teal-600' },
  ]

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        ></div>
      )}
      
      {/* Sidebar */}
      <aside
        className={`fixed md:relative h-screen glass border-r border-blue-100 flex flex-col overflow-hidden transition-all duration-300 z-40 ${
          isOpen ? 'w-64 sm:w-72 opacity-100' : 'w-0 opacity-0 border-r-0'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">Menu</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-blue-200 bg-white/80 text-blue-700 hover:bg-blue-50 transition-colors flex items-center justify-center flex-shrink-0 md:hidden"
            aria-label="Tutup sidebar"
            title="Tutup sidebar"
          >
            <X size={16} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 px-3 sm:px-4 md:px-6 py-6 sm:py-7 space-y-6 sm:space-y-8 overflow-y-auto">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl border transition-all duration-300 ${
                  isActive
                    ? `bg-gradient-to-r ${item.color} text-white shadow-lg hover:shadow-xl border-transparent`
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 border-blue-100'
                }`}
                style={{
                  animation: isActive ? `slideInLeft 0.5s ease-out forwards` : 'none',
                  animationDelay: `${index * 0.1}s`
                }}
              >
                <Icon size={20} className={`sm:w-6 sm:h-6 ${isActive ? 'group-hover:scale-120 transition-transform' : 'text-gray-500 group-hover:text-blue-600'}`} />
                <span className="font-bold flex-1 text-sm sm:text-base">{item.label}</span>
                {isActive && <ChevronRight size={18} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform flex-shrink-0" />}
              </Link>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-blue-100 flex-shrink-0">
          <p className="text-center text-xs text-gray-600 font-medium">Lab Access © 2026</p>
          <p className="text-center text-xs text-gray-500 mt-0.5">v1.0</p>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
