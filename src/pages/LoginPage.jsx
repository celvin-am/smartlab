import React from 'react'
import { Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'

const LoginPage = () => {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/bg-uny.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div
        className="fixed inset-0 bg-gradient-to-br from-blue-500/55 via-blue-400/50 to-purple-600/55"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.55), rgba(96,165,250,0.5), rgba(147,51,234,0.55))'
        }}
      ></div>

      <div className="relative z-10 w-full max-w-3xl">
        <div className="bg-white rounded-[28px] shadow-2xl p-5 sm:p-8 md:p-10 lg:p-12 border border-white/70">
          <div className="flex flex-col items-center justify-center mb-5 sm:mb-6 text-center -mt-3 sm:-mt-4">
            <img src="/uny-logo.png" alt="Logo UNY" className="h-28 sm:h-32 md:h-36 w-auto flex-shrink-0" />
            <p className="mt-0.5 text-2xl sm:text-3xl md:text-[2.25rem] font-bold text-blue-900 leading-none text-center">
              Smart Lab Access
            </p>
            <p className="mt-1 text-xs sm:text-sm text-gray-700 font-semibold text-center">
              Sistem Manajemen Laboratorium
            </p>
          </div>

          <div className="text-center mb-7 sm:mb-9">
            <p className="text-sm text-gray-700 font-semibold mt-1">Pilih akses sesuai peran Anda</p>
          </div>

          <div className="flex flex-col gap-3 sm:gap-4 items-center">
            <Link
              to="/login/pengelola"
              className="w-full max-w-[560px] rounded-xl bg-blue-700 hover:bg-blue-800 px-4 sm:px-5 py-4 sm:py-5 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all min-h-[72px] flex items-center gap-3 sm:gap-4 justify-center"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-white/15 text-white flex items-center justify-center flex-shrink-0">
                <LogIn size={18} className="text-white sm:w-[19px] sm:h-[19px]" />
              </div>
              <div className="min-w-0 text-center flex-1">
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-white leading-tight">Login Pengelola Laboratorium</h2>
              </div>
            </Link>

            <Link
              to="/login/mahasiswa"
              className="w-full max-w-[560px] rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 sm:px-5 py-4 sm:py-5 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all min-h-[72px] flex items-center gap-3 sm:gap-4 justify-center"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-white/15 text-white flex items-center justify-center flex-shrink-0">
                <LogIn size={18} className="text-white sm:w-[19px] sm:h-[19px]" />
              </div>
              <div className="min-w-0 text-center flex-1">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-white">Login Mahasiswa</h2>
              </div>
            </Link>
          </div>

          <p className="text-center text-xs text-gray-600 mt-8 font-medium">© 2026 Universitas Negeri Yogyakarta</p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
