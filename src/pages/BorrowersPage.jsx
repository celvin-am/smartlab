import React, { useEffect, useRef, useState } from 'react'
import { Trash2, Eye, EyeOff, CheckCircle, Clock } from 'lucide-react'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { collection, deleteDoc, doc, getFirestore, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import firebaseConfig from '../firebaseConfig'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
const db = getFirestore(app)

const DEFAULT_BORROWERS = [
  {
    nim: '21101234001',
    name: 'Andi Wijaya',
    prodi: 'Teknik Elekto',
    borrowDate: '2026-03-15',
    component: 'Resistor 10K',
    quantity: 5,
    returned: true,
    hidden: false
  },
  {
    nim: '21101234002',
    name: 'Budi Santoso',
    prodi: 'Teknik Elektronika',
    borrowDate: '2026-03-18',
    component: 'Kapasitor 100uF',
    quantity: 3,
    returned: false,
    hidden: false
  },
  {
    nim: '21101234003',
    name: 'Citra Dewi',
    prodi: 'Teknik Elekto',
    borrowDate: '2026-03-10',
    component: 'LED RGB',
    quantity: 10,
    returned: true,
    hidden: false
  },
  {
    nim: '21101234004',
    name: 'Doni Hermawan',
    prodi: 'Teknik Elektronika',
    borrowDate: '2026-03-20',
    component: 'Arduino Uno',
    quantity: 1,
    returned: false,
    hidden: false
  }
]

const BorrowersPage = () => {
  const [borrowers, setBorrowers] = useState([])
  const hasSeededDefaults = useRef(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')

  useEffect(() => {
    const borrowersRef = collection(db, 'borrowers')

    const unsubscribe = onSnapshot(borrowersRef, (snapshot) => {
      const firestoreBorrowers = snapshot.docs.map((borrowerDoc) => {
        const data = borrowerDoc.data()

        return {
          id: borrowerDoc.id,
          nim: data.nim || '-',
          name: data.name || 'Tanpa Nama',
          prodi: data.prodi || '-',
          borrowDate: data.borrowDate || '-',
          component: data.component || '-',
          quantity: Number(data.quantity || 0),
          returned: Boolean(data.returned),
          hidden: Boolean(data.hidden)
        }
      })

      setBorrowers(firestoreBorrowers)
    })

    return () => unsubscribe()
  }, [])

  const handleDelete = async (id) => {
    const target = borrowers.find((item) => item.id === id)
    const targetName = target?.name || 'data ini'

    if (!window.confirm(`Hapus ${targetName} dari daftar peminjam?`)) {
      return
    }

    setActionError('')
    setActionNotice('')

    try {
      await deleteDoc(doc(db, 'borrowers', id))
      setActionNotice(`${targetName} berhasil dihapus dari daftar peminjam.`)
    } catch (error) {
      console.error('Delete borrower failed:', error)
      setActionError('Gagal menghapus data peminjam. Cek rules borrowers.')
    }
  }

  const handleToggleHide = async (borrower) => {
    await updateDoc(doc(db, 'borrowers', borrower.id), {
      hidden: !borrower.hidden
    })
  }

  const displayedBorrowers = showArchive 
    ? borrowers.filter(b => b.hidden && b.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : borrowers.filter(b => !b.hidden && b.name.toLowerCase().includes(searchTerm.toLowerCase()))
  
  const visibleBorrowers = borrowers.filter(b => !b.hidden && b.name.toLowerCase().includes(searchTerm.toLowerCase()))
  const returnedCount = visibleBorrowers.filter(b => b.returned).length
  const pendingCount = visibleBorrowers.filter(b => !b.returned).length

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 bg-gradient-to-br from-blue-50 via-white to-blue-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-1 sm:mb-2">Daftar Peminjam</h1>
          <p className="text-gray-600 font-medium text-xs sm:text-sm md:text-base">Kelola data peminjaman komponen laboratorium secara efisien</p>
        </div>
        <button
          onClick={() => setShowArchive(!showArchive)}
          className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg sm:rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 whitespace-nowrap text-sm flex-shrink-0 md:self-auto md:mt-1"
        >
          <Eye size={16} className="sm:w-5 sm:h-5" />
          {showArchive ? 'Sembunyikan Arsip' : 'Tampilkan Arsip'}
        </button>
      </div>

      {actionNotice && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {actionNotice}
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {actionError}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-8 md:mb-12">
        <div className="glass rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 backdrop-blur-xl border border-white border-opacity-40">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Total Peminjam</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-600">{visibleBorrowers.length}</p>
            </div>
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg sm:rounded-xl flex-shrink-0">
              <CheckCircle className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        <div className="glass rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 backdrop-blur-xl border border-white border-opacity-40">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Sudah Dikembalikan</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-600">{returnedCount}</p>
            </div>
            <div className="p-2 sm:p-3 bg-green-100 rounded-lg sm:rounded-xl flex-shrink-0">
              <CheckCircle className="text-green-600 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        <div className="glass rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 backdrop-blur-xl border border-white border-opacity-40">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Belum Dikembalikan</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="p-2 sm:p-3 bg-amber-100 rounded-lg sm:rounded-xl flex-shrink-0">
              <Clock className="text-amber-600 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6 md:mb-8">
        <div className="w-full relative">
          <input
            type="text"
            placeholder="Cari Nama Peminjam"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-medium text-sm sm:text-base"
          />
        </div>
      </div>

      {/* Table - Desktop View */}
      <div className="hidden md:block glass rounded-2xl shadow-lg backdrop-blur-xl border border-white border-opacity-40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <th className="px-6 py-4 text-left font-bold text-sm">Nama Peminjam</th>
                <th className="px-6 py-4 text-left font-bold text-sm">NIM</th>
                <th className="px-6 py-4 text-left font-bold text-sm">Program Studi</th>
                <th className="px-6 py-4 text-left font-bold text-sm">Tanggal Peminjaman</th>
                <th className="px-6 py-4 text-left font-bold text-sm">Komponen</th>
                <th className="px-6 py-4 text-center font-bold text-sm">Jumlah</th>
                <th className="px-6 py-4 text-center font-bold text-sm">Status</th>
                <th className="px-6 py-4 text-center font-bold text-sm">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayedBorrowers.length > 0 ? (
                displayedBorrowers.map((borrower, index) => (
                  <tr 
                    key={borrower.id} 
                    className={`border-t border-gray-100 hover:bg-blue-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="px-6 py-4 text-gray-900 font-semibold">{borrower.name}</td>
                    <td className="px-6 py-4 text-gray-700 text-sm">{borrower.nim}</td>
                    <td className="px-6 py-4 text-gray-700 text-sm">{borrower.prodi}</td>
                    <td className="px-6 py-4 text-gray-700">{borrower.borrowDate}</td>
                    <td className="px-6 py-4 text-gray-700 font-medium">{borrower.component}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                        {borrower.quantity} unit
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {borrower.returned ? (
                          <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-bold">
                            <CheckCircle size={16} />
                            Dikembalikan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-bold">
                            <Clock size={16} />
                            Pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleDelete(borrower.id)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors font-semibold"
                          title="Hapus"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleHide(borrower)}
                          className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors font-semibold"
                          title={borrower.hidden ? "Tampilkan" : "Sembunyikan"}
                        >
                          {borrower.hidden ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    <p className="font-medium text-lg">Tidak ada data peminjam</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card View - Mobile */}
      <div className="md:hidden space-y-4">
        {displayedBorrowers.length > 0 ? (
          displayedBorrowers.map((borrower) => (
            <div key={borrower.id} className="glass rounded-xl shadow-lg backdrop-blur-xl border border-white border-opacity-40 p-4">
              <div className="space-y-3">
                {/* Header with status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{borrower.name}</h3>
                    <p className="text-xs text-gray-600">NIM: {borrower.nim}</p>
                  </div>
                  {borrower.returned ? (
                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex-shrink-0">
                      <CheckCircle size={14} />
                      <span className="hidden xs:inline">Kembali</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-bold flex-shrink-0">
                      <Clock size={14} />
                      <span className="hidden xs:inline">Pending</span>
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-600">Program Studi</p>
                    <p className="font-semibold text-gray-900">{borrower.prodi}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Tanggal Pinjam</p>
                    <p className="font-semibold text-gray-900">{borrower.borrowDate}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">Komponen</p>
                    <p className="font-semibold text-gray-900">{borrower.component} ({borrower.quantity} unit)</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-200">
                  <button
                    onClick={() => handleToggleHide(borrower)}
                    className="flex-1 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-semibold text-xs flex items-center justify-center gap-2"
                  >
                    {borrower.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    {borrower.hidden ? 'Tampilkan' : 'Sembunyikan'}
                  </button>
                  <button
                    onClick={() => handleDelete(borrower.id)}
                    className="flex-1 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-semibold text-xs flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 font-medium">Tidak ada data peminjam</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default BorrowersPage
