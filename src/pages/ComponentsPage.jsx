import React, { useEffect, useState } from 'react'
import { AlertTriangle, TrendingUp, Package, Zap, Plus, X, Upload, Trash2, Pencil } from 'lucide-react'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { addDoc, collection, deleteDoc, doc, getFirestore, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import firebaseConfig from '../firebaseConfig'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
const db = getFirestore(app)
const MAX_IMAGE_SIZE_BYTES = 350 * 1024
const SAVE_TIMEOUT_MS = 12000
const COMPONENTS_CACHE_KEY = 'labaccess_components_cache_v1'
const COMPONENTS_DELETED_IDS_KEY = 'labaccess_components_deleted_ids_v1'

const withTimeout = (promise, timeoutMs) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('SAVE_TIMEOUT')), timeoutMs)
    })
  ])
}

const normalizeText = (value) => String(value || '').trim().toLowerCase()

const componentIdentityKey = (component) => {
  const codeKey = normalizeText(component.code)
  const nameKey = normalizeText(component.name)
  return `${codeKey}::${nameKey}`
}

const dedupeComponents = (items) => {
  const seen = new Set()
  const deduped = []

  for (const item of items) {
    const key = componentIdentityKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  return deduped
}

const mergeRemoteAndLocalComponents = (remoteItems) => {
  const cachedItems = readCachedComponents()
  return dedupeComponents([...remoteItems, ...cachedItems])
}

const readCachedComponents = () => {
  try {
    const raw = localStorage.getItem(COMPONENTS_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeCachedComponents = (items) => {
  try {
    localStorage.setItem(COMPONENTS_CACHE_KEY, JSON.stringify(items))
  } catch {
    // Ignore localStorage write failures silently.
  }
}

const readDeletedIds = () => {
  try {
    const raw = localStorage.getItem(COMPONENTS_DELETED_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeDeletedIds = (ids) => {
  try {
    localStorage.setItem(COMPONENTS_DELETED_IDS_KEY, JSON.stringify(ids))
  } catch {
    // Ignore localStorage write failures silently.
  }
}

const ComponentsPage = () => {
  const [components, setComponents] = useState(() => readCachedComponents())
  const [deletedIds, setDeletedIds] = useState(() => readDeletedIds())
  const [deletingId, setDeletingId] = useState('')
  const [saveError, setSaveError] = useState('')
  const [syncNotice, setSyncNotice] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [editFormData, setEditFormData] = useState({
    quantity: '',
    safeStock: ''
  })
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    quantity: '',
    safeStock: '',
    imageFile: null,
    imagePreview: null
  })

  useEffect(() => {
    const partsRef = collection(db, 'parts')
    const unsubscribe = onSnapshot(partsRef, (snapshot) => {
      const firestoreComponents = snapshot.docs
        .map((componentDoc) => {
          const data = componentDoc.data()
          return {
            id: componentDoc.id,
            code: data.code || '-',
            name: data.name || 'Tanpa Nama',
            quantity: Number(data.quantity || 0),
            safeStock: Number(data.safeStock || 1),
            imageUrl: data.imageUrl || 'https://via.placeholder.com/200?text=Komponen'
          }
        })
        .filter((component) => !deletedIds.includes(component.id))

      const uniqueComponents = mergeRemoteAndLocalComponents(firestoreComponents)

      setComponents(uniqueComponents)
      setSyncNotice('')
      setSaveError('')
    }, (error) => {
      if (error.code === 'permission-denied') {
        setSyncNotice('Akses Firebase ditolak. Data akan disimpan sementara di browser.')
      } else {
        setSyncNotice('Gagal mengambil data Firebase. Data sementara menggunakan penyimpanan browser.')
      }
    })

    return () => unsubscribe()
  }, [deletedIds])

  useEffect(() => {
    writeCachedComponents(components)
  }, [components])

  useEffect(() => {
    writeDeletedIds(deletedIds)
  }, [deletedIds])

  const handleImageUpload = (e) => {
    setSaveError('')
    const file = e.target.files[0]
    if (file) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setSaveError('Ukuran gambar terlalu besar. Maksimal 350KB agar bisa tersimpan stabil di Firebase.')
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData({
          ...formData,
          imageFile: file,
          imagePreview: reader.result
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddComponent = async (e) => {
    e.preventDefault()
    if (isSaving) return

    const quantity = parseInt(formData.quantity, 10)
    const safeStock = parseInt(formData.safeStock, 10)

    if (!formData.code || !formData.name || Number.isNaN(quantity) || Number.isNaN(safeStock) || quantity < 0 || safeStock < 1) {
      setSaveError('Lengkapi form dengan benar. Jumlah stok minimal 0 dan batas aman minimal 1.')
      return
    }

    const incomingIdentity = componentIdentityKey({
      code: formData.code,
      name: formData.name
    })

    const alreadyExists = components.some((component) => componentIdentityKey(component) === incomingIdentity)
    if (alreadyExists) {
      setSaveError('Komponen dengan nama dan kode yang sama sudah ada.')
      return
    }

    if (formData.code && formData.name && formData.quantity && formData.safeStock) {
      const optimisticComponent = {
        id: `local-${Date.now()}`,
        code: formData.code.trim(),
        name: formData.name.trim(),
        quantity,
        safeStock,
        imageUrl: formData.imagePreview || 'https://via.placeholder.com/200?text=Komponen'
      }

      setComponents((prev) => dedupeComponents([...prev, optimisticComponent]))
      setFormData({ code: '', name: '', quantity: '', safeStock: '', imageFile: null, imagePreview: null })
      setSaveError('')
      setShowModal(false)

      try {
        setIsSaving(true)

        await withTimeout(addDoc(collection(db, 'parts'), {
          code: formData.code.trim(),
          name: formData.name.trim(),
          quantity,
          safeStock,
          imageUrl: formData.imagePreview || 'https://via.placeholder.com/200?text=Komponen',
          createdAt: serverTimestamp()
        }), SAVE_TIMEOUT_MS)

        setSyncNotice('')
      } catch (error) {
        if (error.message === 'SAVE_TIMEOUT') {
          setSyncNotice('Firebase lambat merespons. Data disimpan lokal dulu di browser.')
        } else if (error.code === 'permission-denied') {
          setSyncNotice('Firebase menolak akses. Data disimpan lokal dulu di browser.')
        } else if (error.code === 'resource-exhausted' || error.code === 'failed-precondition') {
          setSyncNotice('Ukuran data terlalu besar untuk Firebase. Data disimpan lokal dulu di browser.')
        } else {
          setSyncNotice('Koneksi Firebase bermasalah. Data disimpan lokal dulu di browser.')
        }

        console.error('Add component failed:', error)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleDeleteComponent = async (id) => {
    const idAsString = String(id)
    if (deletingId === idAsString) return

    setDeletingId(idAsString)
    setComponents((prev) => prev.filter((c) => String(c.id) !== idAsString))

    if (String(id).startsWith('local-')) {
      setDeletingId('')
      return
    }

    try {
      setDeletedIds((prev) => [...prev, idAsString])
      await deleteDoc(doc(db, 'parts', idAsString))
    } catch (error) {
      setSyncNotice('Hapus komponen tersimpan lokal, tetapi Firebase menolak hapus. Cek rules parts.')
      console.error('Delete component failed:', error)
    } finally {
      setDeletingId('')
    }
  }

  const openEditModal = (component) => {
    setShowModal(false)
    setSaveError('')
    setEditingId(String(component.id))
    setEditFormData({
      quantity: String(component.quantity),
      safeStock: String(component.safeStock)
    })
    setEditModalOpen(true)
  }

  const handleUpdateComponentStock = async (e) => {
    e.preventDefault()
    if (isUpdating || !editingId) return

    const quantity = parseInt(editFormData.quantity, 10)
    const safeStock = parseInt(editFormData.safeStock, 10)

    if (Number.isNaN(quantity) || Number.isNaN(safeStock) || quantity < 0 || safeStock < 1) {
      setSaveError('Isi jumlah stok dan batas aman dengan benar. Jumlah stok minimal 0 dan batas aman minimal 1.')
      return
    }

    setSaveError('')
    setComponents((prev) => prev.map((c) => (
      String(c.id) === editingId
        ? { ...c, quantity, safeStock }
        : c
    )))
    setEditModalOpen(false)

    if (editingId.startsWith('local-')) {
      setEditingId('')
      return
    }

    try {
      setIsUpdating(true)
      await withTimeout(
        updateDoc(doc(db, 'parts', editingId), { quantity, safeStock }),
        SAVE_TIMEOUT_MS
      )
      setSyncNotice('')
    } catch (error) {
      if (error.message === 'SAVE_TIMEOUT') {
        setSyncNotice('Update stok timeout. Perubahan tersimpan lokal dulu di browser.')
      } else if (error.code === 'permission-denied') {
        setSyncNotice('Firebase menolak update stok. Perubahan tersimpan lokal dulu di browser.')
      } else {
        setSyncNotice('Update stok ke Firebase gagal. Perubahan tersimpan lokal dulu di browser.')
      }
      console.error('Update component stock failed:', error)
    } finally {
      setIsUpdating(false)
      setEditingId('')
    }
  }

  const getStockLevel = (quantity, safeStock) => {
    const safe = Math.max(Number(safeStock) || 1, 1)
    const percent = (Number(quantity) / safe) * 100

    if (percent > 100) return 'many'
    if (percent > 75) return 'enough'
    if (percent > 25) return 'limited'
    return 'critical'
  }

  const getStatusColor = (quantity, safeStock) => {
    const level = getStockLevel(quantity, safeStock)

    if (level === 'many') return { bg: 'bg-green-100', text: 'text-green-700', label: 'Stok Banyak' }
    if (level === 'enough') return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Stok Cukup' }
    if (level === 'limited') return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Stok Terbatas' }
    return { bg: 'bg-red-100', text: 'text-red-700', label: 'Stok Kritis' }
  }

  const getStatusIcon = (quantity, safeStock) => {
    const level = getStockLevel(quantity, safeStock)

    if (level === 'many') return <TrendingUp size={20} className="text-green-600" />
    if (level === 'enough') return <Zap size={20} className="text-blue-600" />
    if (level === 'limited') return <AlertTriangle size={20} className="text-amber-600" />
    return <AlertTriangle size={20} className="text-red-600" />
  }

  const totalComponents = components.length
  const stockMany = components.filter((c) => getStockLevel(c.quantity, c.safeStock) === 'many').length
  const stockEnough = components.filter((c) => getStockLevel(c.quantity, c.safeStock) === 'enough').length
  const limitedStock = components.filter((c) => getStockLevel(c.quantity, c.safeStock) === 'limited').length
  const criticalStock = components.filter((c) => getStockLevel(c.quantity, c.safeStock) === 'critical').length
  const visibleComponents = components.filter((component) => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return true
    return String(component.name || '').toLowerCase().includes(term) || String(component.code || '').toLowerCase().includes(term)
  })

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 bg-gradient-to-br from-blue-50 via-white to-blue-50 min-h-screen">
      {/* Header with Add Button */}
      <div className="mb-6 sm:mb-8 md:mb-10 flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text mb-1 sm:mb-2">Komponen Laboratorium</h1>
          <p className="text-gray-600 font-medium text-xs sm:text-sm md:text-base">Daftar lengkap komponen elektronik yang tersedia</p>
        </div>
        <div className="w-full sm:w-auto xl:ml-auto xl:mt-1 space-y-2 sm:space-y-3">
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 sm:py-3.5 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 text-white rounded-lg sm:rounded-xl font-bold shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 active:scale-95 text-sm sm:text-base flex-shrink-0"
          >
            <Plus size={18} className="sm:w-5 sm:h-5" />
            Tambah Komponen
          </button>
          <div className="relative w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari Komponen"
              aria-label="Cari komponen"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-lg sm:rounded-xl bg-white focus:outline-none focus:border-blue-500 text-sm sm:text-base"
            />
          </div>
        </div>
      </div>

      {syncNotice && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 font-medium">
          {syncNotice}
        </div>
      )}

      {/* Modal Tambah Komponen */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 max-w-sm sm:max-w-lg w-full border border-blue-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4 sm:mb-6 md:mb-8 gap-3">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Tambah Komponen Baru</h2>
                <p className="text-gray-600 text-xs sm:text-sm mt-1">Lengkapi data untuk menambah komponen laboratorium</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false)
                  setSaveError('')
                  setFormData({ code: '', name: '', quantity: '', safeStock: '', imageFile: null, imagePreview: null })
                }}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-500 hover:text-red-700 flex-shrink-0"
              >
                <X size={20} className="sm:w-7 sm:h-7" />
              </button>
            </div>

            {saveError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">
                {saveError}
              </div>
            )}

            <form onSubmit={handleAddComponent} className="space-y-6">
              {/* Image Upload Section */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-800">📸 Foto Komponen</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="imageInput"
                  />
                  <label
                    htmlFor="imageInput"
                    className="block w-full p-6 border-2 border-dashed border-blue-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group bg-blue-50/50"
                  >
                    {formData.imagePreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <img src={formData.imagePreview} alt="Preview" className="h-24 w-24 object-cover rounded-xl" />
                        <p className="text-sm font-semibold text-blue-600">Ganti Foto</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload size={32} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                        <p className="text-sm font-semibold text-gray-700">Pilih foto dari file manager</p>
                        <p className="text-xs text-gray-500">JPG, PNG, GIF (max 5MB)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Code Input */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-800">Kode Komponen</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Contoh: RES-10K"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white/80 backdrop-blur-sm"
                />
              </div>

              {/* Name Input */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-800">Nama Komponen</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Resistor 10K Ohm"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white/80 backdrop-blur-sm"
                />
              </div>

              {/* Quantity Input */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-800">Jumlah Stok</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="Contoh: 45"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white/80 backdrop-blur-sm"
                />
              </div>

              {/* Safe Stock Input */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-800">Batas Aman Stok</label>
                <input
                  type="number"
                  value={formData.safeStock}
                  onChange={(e) => setFormData({ ...formData, safeStock: e.target.value })}
                  placeholder="Contoh: 20"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white/80 backdrop-blur-sm"
                />
                <p className="text-xs text-gray-500">Jika stok di bawah nilai ini, komponen akan ditandai terbatas.</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-2xl hover:scale-105 transition-all active:scale-95"
                >
                  <Plus size={20} />
                  {isSaving ? 'Menyimpan...' : 'Tambahkan Komponen'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setSaveError('')
                    setFormData({ code: '', name: '', quantity: '', safeStock: '', imageFile: null, imagePreview: null })
                  }}
                  className="flex-1 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all hover:border-gray-400"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 md:p-8 max-w-sm sm:max-w-md w-full border border-blue-100">
            <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Edit Stok Komponen</h2>
                <p className="text-gray-600 text-xs sm:text-sm mt-1">Ubah jumlah stok dan batas aman stok komponen</p>
              </div>
              <button
                onClick={() => {
                  setEditModalOpen(false)
                  setSaveError('')
                  setEditingId('')
                }}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-500 hover:text-red-700 flex-shrink-0"
                type="button"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>

            {saveError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">
                {saveError}
              </div>
            )}

            <form onSubmit={handleUpdateComponentStock} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-800">Jumlah Stok</label>
                <input
                  type="number"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white/80"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-800">Batas Aman Stok</label>
                <input
                  type="number"
                  value={editFormData.safeStock}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, safeStock: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white/80"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-2xl hover:scale-105 transition-all active:scale-95"
                >
                  <Pencil size={18} />
                  {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false)
                    setSaveError('')
                    setEditingId('')
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all hover:border-gray-400"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-6 mb-6 sm:mb-8">
        <div className="glass rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 backdrop-blur-xl border border-white border-opacity-40 group hover:shadow-xl transition-shadow">
          <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Total Komponen</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">{totalComponents}</p>
            </div>
            <Package className="text-blue-400 group-hover:scale-110 transition-transform flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

        <div className="glass rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 backdrop-blur-xl border border-white border-opacity-40 group hover:shadow-xl transition-shadow">
          <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Stok Banyak</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">{stockMany}</p>
            </div>
            <TrendingUp className="text-green-400 group-hover:scale-110 transition-transform flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

        <div className="glass rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 backdrop-blur-xl border border-white border-opacity-40 group hover:shadow-xl transition-shadow">
          <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Stok Cukup</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">{stockEnough}</p>
            </div>
            <Zap className="text-blue-400 group-hover:scale-110 transition-transform flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

        <div className="glass rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 backdrop-blur-xl border border-white border-opacity-40 group hover:shadow-xl transition-shadow">
          <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Stok Terbatas</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-amber-600">{limitedStock}</p>
            </div>
            <Zap className="text-amber-400 group-hover:scale-110 transition-transform flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

        <div className="glass rounded-lg sm:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 backdrop-blur-xl border border-white border-opacity-40 group hover:shadow-xl transition-shadow">
          <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Stok Kritis</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-red-600">{criticalStock}</p>
            </div>
            <AlertTriangle className="text-red-400 group-hover:scale-110 transition-transform flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>
      </div>

      {/* Components Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
        {visibleComponents.map((component) => {
          const status = getStatusColor(component.quantity, component.safeStock)
          
          return (
            <div 
              key={component.id} 
              className="glass rounded-2xl shadow-lg backdrop-blur-xl border border-white border-opacity-40 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group"
            >
              {/* Header with Image */}
              <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-4 h-40 flex items-center justify-center relative overflow-hidden">
                {component.imageUrl ? (
                  <img
                    src={component.imageUrl}
                    alt={component.name}
                    className="w-full h-full object-contain p-1 bg-white/90 rounded-lg group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : (
                  <Package size={80} className="text-white opacity-60" />
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Status */}
                <div className="mb-4 flex items-center justify-between">
                  <span className={`text-xs font-bold ${status.text} ${status.bg} px-3 py-1 rounded-full flex items-center gap-1`}>
                    {getStatusIcon(component.quantity, component.safeStock)}
                    {status.label}
                  </span>
                </div>

                {/* Title */}
                <h3 className="mb-4 text-lg font-bold text-gray-900 line-clamp-2">
                  {component.name}
                </h3>

                {/* Quantity */}
                <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-gray-600 text-xs font-medium mb-1">Jumlah Stok</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-blue-600">{component.quantity}</p>
                    <p className="text-gray-600 font-medium">unit</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Batas aman: {component.safeStock} unit</p>
                </div>

                {/* Progress Bar */}
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(component.quantity / 2, 100)}%` }}
                  ></div>
                </div>

                {/* Footer */}
                <p className="text-xs text-gray-500 mt-3 font-medium">
                  {component.quantity < Math.max(Math.floor(component.safeStock * 0.7), 1) && '⚠️ Segera pesan ulang'}
                  {component.quantity >= Math.max(Math.floor(component.safeStock * 0.7), 1) && component.quantity < component.safeStock && '📊 Monitoring stok'}
                  {component.quantity >= component.safeStock && '✅ Stok aman'}
                </p>

                {/* Action Buttons */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => openEditModal(component)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all active:scale-95"
                  >
                    <Pencil size={18} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteComponent(component.id)}
                    disabled={deletingId === String(component.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all active:scale-95"
                  >
                    <Trash2 size={18} />
                    {deletingId === String(component.id) ? 'Menghapus...' : 'Hapus'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ComponentsPage
