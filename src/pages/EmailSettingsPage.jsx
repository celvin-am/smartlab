import React, { useEffect, useState } from 'react'
import { Fingerprint, Trash2, Plus, Mail } from 'lucide-react'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { addDoc, collection, deleteDoc, doc, getFirestore, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import firebaseConfig from '../firebaseConfig'
import { RPI_ENDPOINT } from '../rpiConfig'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
const db = getFirestore(app)
const EMAIL_SETTINGS_CACHE_KEY = 'labaccess_email_settings_cache_v1'

const readCachedEmails = () => {
  try {
    const raw = localStorage.getItem(EMAIL_SETTINGS_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeCachedEmails = (items) => {
  try {
    localStorage.setItem(EMAIL_SETTINGS_CACHE_KEY, JSON.stringify(items))
  } catch {
    // Ignore localStorage failures silently.
  }
}

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const dedupeEmails = (items) => {
  const seen = new Set()
  const deduped = []

  for (const item of items) {
    const key = normalizeEmail(item.email)
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  return deduped
}

const mergeEmailLists = (remoteItems, cachedItems) => {
  return dedupeEmails([...remoteItems, ...cachedItems])
}

const parseEmailInput = (value) => {
  return String(value || '')
    .split(/[,;\n\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

const fingerprintModeLabels = {
  register: 'Register Fingerprint',
  verify: 'Verify Fingerprint'
}

const fingerprintStatusLabels = {
  pending: 'Menunggu pendaftaran fingerprint',
  registered: 'Fingerprint terdaftar',
  verified: 'Fingerprint terverifikasi',
  unknown: 'Belum diatur'
}

const EmailSettingsPage = () => {
  const [emails, setEmails] = useState(() => readCachedEmails())
  const [name, setName] = useState('')
  const [nim, setNim] = useState('')
  const [prodi, setProdi] = useState('')
  const [email, setEmail] = useState('')
  const [fingerprintMode, setFingerprintMode] = useState('register')
  const [loading, setLoading] = useState(false)
  const [fingerprintActionLoading, setFingerprintActionLoading] = useState('')
  const [error, setError] = useState('')
  const [syncNotice, setSyncNotice] = useState('')
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    const emailsRef = collection(db, 'student_email_settings')

    const unsubscribe = onSnapshot(emailsRef, (snapshot) => {
      const remoteEmails = snapshot.docs.map((itemDoc) => {
        const data = itemDoc.data()
        return {
          id: itemDoc.id,
          name: data.name || '',
          nim: data.nim || '',
          prodi: data.prodi || '',
          email: data.email || '',
          fingerprintMode: data.fingerprintMode || 'register',
          fingerprintStatus: data.fingerprintStatus || 'unknown',
          fingerprintId: data.fingerprintId || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('id-ID') : '-'
        }
      })

      setEmails((prev) => mergeEmailLists(remoteEmails, prev))
      setSyncNotice('')
    }, (snapshotError) => {
      if (snapshotError.code === 'permission-denied') {
        setSyncNotice('Akses Firebase ditolak. Data disimpan sementara di browser.')
      } else {
        setSyncNotice('Firebase tidak tersedia. Data disimpan sementara di browser.')
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    writeCachedEmails(emails)
  }, [emails])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const parsedEmails = parseEmailInput(email)
    const trimmedName = name.trim()
    const trimmedNim = nim.trim()
    const trimmedProdi = prodi.trim()

    if (parsedEmails.length === 0) {
      setError('Email harus diisi')
      return
    }

    if (!trimmedNim) {
      setError('NIM harus diisi')
      return
    }

    if (!trimmedProdi) {
      setError('Program Studi harus diisi')
      return
    }

    const invalidEmail = parsedEmails.find((item) => !normalizeEmail(item).endsWith('@student.uny.ac.id'))
    if (invalidEmail) {
      setError('Gunakan email SSO kampus dengan domain @student.uny.ac.id')
      return
    }

    const nextItems = parsedEmails.map((item, index) => ({
      id: `local-${Date.now()}-${index}`,
      name: trimmedName,
      nim: trimmedNim,
      prodi: trimmedProdi,
      email: item,
      fingerprintMode,
      fingerprintStatus: fingerprintMode === 'register' ? 'pending' : 'unknown',
      fingerprintId: '',
      createdAt: new Date().toLocaleDateString('id-ID')
    }))

    setEmails((prev) => dedupeEmails([...nextItems, ...prev]))
    setName('')
    setNim('')
    setProdi('')
    setEmail('')
    setLoading(true)

    try {
      await Promise.all(
        nextItems.map((item) => addDoc(collection(db, 'student_email_settings'), {
          name: item.name,
          nim: item.nim,
          prodi: item.prodi,
          email: item.email,
          fingerprintMode: item.fingerprintMode,
          fingerprintStatus: item.fingerprintStatus,
          fingerprintId: item.fingerprintId,
          createdAt: serverTimestamp()
        }))
      )
      setSyncNotice('')
    } catch (submitError) {
      if (submitError.code === 'permission-denied') {
        setSyncNotice('Email tersimpan lokal dulu karena rules Firebase menolak akses.')
      } else {
        setSyncNotice('Email tersimpan lokal dulu karena Firebase bermasalah.')
      }
      console.error('Add email failed:', submitError)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestFingerprintRegistration = async (item) => {
    const idAsString = String(item.id)
    if (!idAsString || idAsString.startsWith('local-')) return

    setFingerprintActionLoading(idAsString)

    try {
      await updateDoc(doc(db, 'student_email_settings', idAsString), {
        fingerprintMode: 'register',
        fingerprintStatus: 'pending',
        fingerprintId: ''
      })
      setEmails((prev) => prev.map((row) => (
        String(row.id) === idAsString
          ? { ...row, fingerprintMode: 'register', fingerprintStatus: 'pending', fingerprintId: '' }
          : row
      )))
      setSyncNotice('Permintaan registrasi fingerprint sudah disimpan. Raspberry Pi bisa membaca status pending ini.')

      if (RPI_ENDPOINT) {
        try {
          const response = await fetch(`${RPI_ENDPOINT}/api/fingerprint/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              student_nim: item.nim,
              student_name: item.name,
              student_email: item.email,
            }),
          })

          const data = await response.json()
          if (!response.ok || !data.success) {
            throw new Error(data.error || `HTTP ${response.status}`)
          }

          setSyncNotice('Permintaan fingerprint dikirim langsung ke Raspberry Pi.')
        } catch (rpiError) {
          setSyncNotice(`Firebase pending disimpan. Gagal kirim ke Raspberry Pi: ${rpiError.message}`)
          console.error('Raspberry Pi request failed:', rpiError)
        }
      }
    } catch (requestError) {
      setSyncNotice('Gagal mengubah status fingerprint di Firebase.')
      console.error('Request fingerprint registration failed:', requestError)
    } finally {
      setFingerprintActionLoading('')
    }
  }

  const handleDelete = async (item) => {
    const idAsString = String(item.id)
    if (deletingId === idAsString) return

    const fingerprintId = String(item.fingerprintId || '').trim()
    setDeletingId(idAsString)
    setEmails((prev) => prev.filter((row) => String(row.id) !== idAsString))

    if (idAsString.startsWith('local-')) {
      setDeletingId('')
      return
    }

    try {
      if (fingerprintId && fingerprintId !== '0' && RPI_ENDPOINT) {
        try {
          const response = await fetch(`${RPI_ENDPOINT}/api/fingerprint/template`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fingerprint_id: Number(fingerprintId) }),
          })

          const result = await response.json()
          if (!response.ok || !result.success) {
            console.warn('Fingerprint delete request failed:', result)
            setSyncNotice(`Gagal hapus template fingerprint ${fingerprintId} di Raspberry Pi.`)
          } else {
            setSyncNotice(`Template fingerprint ${fingerprintId} berhasil dihapus dari Raspberry Pi.`)
          }
        } catch (rpiDeleteError) {
          console.error('Raspberry Pi delete template failed:', rpiDeleteError)
          setSyncNotice(`Gagal hubungi Raspberry Pi untuk hapus template fingerprint ${fingerprintId}.`)        
        }
      }

      await deleteDoc(doc(db, 'student_email_settings', idAsString))
    } catch (deleteError) {
      setSyncNotice('Gagal menghapus di Firebase. Perubahan tetap tercatat di browser.')
      console.error('Delete email failed:', deleteError)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-blue-50 min-h-screen">
      <div className="w-full space-y-5 sm:space-y-6">
        <div className="glass w-full rounded-2xl shadow-lg backdrop-blur-xl border border-white border-opacity-40 p-4 sm:p-6 md:p-8">
          <div className="flex items-start gap-3 mb-6">
            <div className="p-2 sm:p-3 bg-emerald-100 rounded-xl flex-shrink-0">
              <Mail className="text-emerald-600 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text">Setting Email</h1>
              <p className="text-gray-600 text-xs sm:text-sm md:text-base mt-1">
                Tambahkan email SSO mahasiswa yang diizinkan masuk ke Login Page Mahasiswa.
              </p>
            </div>
          </div>

          {syncNotice && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 font-medium">
              {syncNotice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-3 sm:gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 text-center">Nama Mahasiswa</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=""
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-sm sm:text-base text-center"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 text-center">NIM</label>
              <input
                type="text"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
                placeholder="Contoh: 2022xxxxxx"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-sm sm:text-base text-center"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 text-center">Program Studi</label>
              <input
                type="text"
                value={prodi}
                onChange={(e) => setProdi(e.target.value)}
                placeholder="Contoh: Teknik Elektronika"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-sm sm:text-base text-center"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 text-center">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Contoh: Nama.2022@student.uny.ac.id"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-sm sm:text-base text-center"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2 text-center">Mode Fingerprint</label>
              <select
                value={fingerprintMode}
                onChange={(e) => setFingerprintMode(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-sm sm:text-base text-center"
              >
                <option value="register">Register Fingerprint</option>
                <option value="verify">Verify Fingerprint</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-emerald-500 text-white rounded-lg font-bold shadow-lg hover:shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-70"
            >
              <Plus size={18} />
              {loading ? 'Menyimpan...' : 'Tambah Email'}
            </button>
          </form>

          <p className="mt-2 text-xs text-gray-500">Bisa isi lebih dari satu email dengan koma, spasi, atau baris baru.</p>

          {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
        </div>

        <div className="glass w-full rounded-2xl shadow-lg backdrop-blur-xl border border-white border-opacity-40 p-4 sm:p-6 md:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Daftar Email Penerima ({emails.length})</h2>

          <div className="space-y-3">
            {emails.length > 0 ? (
              emails.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white/80 p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                      {item.name || 'Tanpa nama'}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 break-all">NIM: {item.nim || '-'}</p>
                    <p className="text-xs sm:text-sm text-gray-500 break-all">Program Studi: {item.prodi || '-'}</p>
                    <p className="text-xs sm:text-sm text-gray-500 break-all">{item.email}</p>
                    <p className="text-xs sm:text-sm text-gray-500 break-all">
                      Mode Fingerprint: {fingerprintModeLabels[item.fingerprintMode] || 'Register Fingerprint'}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 break-all">
                      Status Fingerprint: {fingerprintStatusLabels[item.fingerprintStatus] || fingerprintStatusLabels.unknown}
                    </p>
                    {item.fingerprintId ? (
                      <p className="text-xs sm:text-sm text-gray-500 break-all">Fingerprint ID: {item.fingerprintId}</p>
                    ) : null}
                    <p className="text-xs text-gray-400 mt-1">Ditambahkan: {item.createdAt}</p>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRequestFingerprintRegistration(item)}
                      disabled={fingerprintActionLoading === String(item.id) || deletingId === String(item.id)}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors"
                      aria-label="Register fingerprint"
                      title="Register fingerprint"
                    >
                      <Fingerprint size={18} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === String(item.id)}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                      aria-label="Hapus email"
                      title="Hapus email"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                Belum ada email yang ditambahkan
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailSettingsPage
