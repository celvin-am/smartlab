import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore'
import firebaseConfig from '../firebaseConfig'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
const db = getFirestore(app)

const StudentLoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const PasswordIcon = showPassword ? EyeOff : Eye

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email || !password) {
        setError('Email dan password harus diisi')
        setLoading(false)
        return
      }

      const normalizedEmail = email.trim().toLowerCase()
      const enteredNim = password.trim()

      const allowedQuery = query(
        collection(db, 'student_email_settings'),
        where('email', '==', normalizedEmail)
      )
      const allowedSnapshot = await getDocs(allowedQuery)

      if (allowedSnapshot.empty) {
        setError('Email SSO belum didaftarkan oleh pengelola')
        setLoading(false)
        return
      }

      const studentData = allowedSnapshot.docs[0].data()
      const registeredNim = String(studentData?.nim || '').trim()

      if (!registeredNim) {
        setError('NIM belum didaftarkan oleh pengelola')
        setLoading(false)
        return
      }

      if (enteredNim !== registeredNim) {
        setError('NIM (password) tidak sesuai')
        setLoading(false)
        return
      }

      sessionStorage.setItem('labaccess_role', 'student')
      sessionStorage.setItem('labaccess_student_email', normalizedEmail)
      sessionStorage.setItem('labaccess_student_nim', enteredNim)
      sessionStorage.setItem('labaccess_student_name', String(studentData?.name || 'Mahasiswa'))
      sessionStorage.setItem('labaccess_student_prodi', String(studentData?.prodi || '-'))
      navigate('/student')
    } catch (err) {
      if (err.code === 'permission-denied') {
        setError('Akses Firestore ditolak. Cek rules email mahasiswa.')
      } else {
        setError('Login gagal')
      }
      setLoading(false)
    }
  }

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
        className="fixed inset-0 bg-gradient-to-br from-emerald-500/55 via-cyan-400/45 to-blue-600/55"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.55), rgba(34,211,238,0.45), rgba(37,99,235,0.55))'
        }}
      ></div>

      <div className="relative z-10">
        <div
          className="bg-white rounded-3xl shadow-2xl p-12"
          style={{
            width: 'min(520px, 94vw)',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.28)',
            padding: '56px 52px'
          }}
        >
          <div className="flex flex-col items-center justify-center text-center mb-8 -mt-1">
            <img src="/uny-logo.png" alt="Logo UNY" className="h-28 sm:h-32 md:h-36 w-auto flex-shrink-0" />
            <p className="mt-1 text-2xl sm:text-3xl font-bold text-blue-900 leading-none text-center">
              Smart Lab Access
            </p>
            <p className="mt-1 text-sm text-gray-700 font-semibold text-center">
              Akses dibuka hanya untuk email SSO yang didaftarkan pengelola
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-600 rounded-lg">
              <p className="text-red-800 text-sm font-bold">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2.5">Email SSO Mahasiswa</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama.2022@student.uny.ac.id"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-400"
                style={{
                  width: '100%',
                  backgroundColor: '#f9fafb',
                  border: '2px solid #d1d5db',
                  borderRadius: '10px',
                  padding: '12px 14px'
                }}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-400"
                  style={{
                    width: '100%',
                    backgroundColor: '#f9fafb',
                    border: '2px solid #d1d5db',
                    borderRadius: '10px',
                    padding: '12px 14px'
                  }}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  <PasswordIcon size={20} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition duration-300 flex items-center justify-center gap-2 mt-8"
              style={{
                width: '100%',
                background: 'linear-gradient(90deg, #059669, #0891b2)',
                color: '#ffffff',
                borderRadius: '10px',
                padding: '12px 16px',
                border: 'none'
              }}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Sedang masuk...
                </>
              ) : (
                <>
                  <ArrowRight size={18} />
                  Login Mahasiswa
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default StudentLoginPage
