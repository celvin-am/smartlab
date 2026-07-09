import React, { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Play, ScanLine, Square } from 'lucide-react'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { addDoc, collection, doc, getDocs, getFirestore, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import firebaseConfig from '../firebaseConfig'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
const db = getFirestore(app)

const DEFAULT_ITEMS = [
  'Controller ESP32',
  'Arduino Uno',
  'Breadboard',
  'Kabel Jumper',
  'Sensor Ultrasonik'
]

const RECOGNITION_URL = (import.meta.env.VITE_RECOGNITION_URL || 'http://localhost:5001').replace(/\/$/, '')
const HARDWARE_URL = (import.meta.env.VITE_HARDWARE_URL || RECOGNITION_URL).replace(/\/$/, '')

const normalizeComponentName = (value) => {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const matchesComponentName = (left, right) => {
  const normalizedLeft = normalizeComponentName(left)
  const normalizedRight = normalizeComponentName(right)

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  )
}

const StudentPortalPage = () => {
  const [student, setStudent] = useState({
    name: 'Mahasiswa',
    email: '',
    nim: '',
    prodi: '-'
  })
  const [status, setStatus] = useState('meminjam')
  const [catalog, setCatalog] = useState([])
  const [cameraOn, setCameraOn] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [detected, setDetected] = useState(null)
  const [capturedImage, setCapturedImage] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [recognizing, setRecognizing] = useState(false)
  const [remoteStreamUrl, setRemoteStreamUrl] = useState(null)
  const streamIntervalRef = useRef(null)

  const stopCamera = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current)
      streamIntervalRef.current = null
    }
    setCameraOn(false)
    setScanning(false)
    setCapturedImage('')
    setDetected(null)
    setRemoteStreamUrl(null)
  }

  const handlePrepareExit = async (selectedStatus, componentName) => {
    const response = await fetch(`${HARDWARE_URL}/api/door/prepare-exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: selectedStatus,
        componentName: componentName || '',
        component: componentName || '',
        student_nim: student.nim || '',
        student_id: student.nim || '',
        direction: 'keluar'
      })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Gagal menyiapkan fingerprint keluar.')
    }

    return data
  }

  useEffect(() => {
    const storedName = sessionStorage.getItem('labaccess_student_name') || 'Mahasiswa'
    const storedEmail = sessionStorage.getItem('labaccess_student_email') || ''
    const storedNim = sessionStorage.getItem('labaccess_student_nim') || ''
    const storedProdi = sessionStorage.getItem('labaccess_student_prodi') || '-'

    setStudent({
      name: storedName,
      email: storedEmail,
      nim: storedNim,
      prodi: storedProdi
    })

    const partsRef = collection(db, 'parts')
    const unsubscribe = onSnapshot(partsRef, (snapshot) => {
      const parts = snapshot.docs
        .map((itemDoc) => String(itemDoc.data()?.name || '').trim())
        .filter(Boolean)

      setCatalog(parts)
    }, () => {
      setCatalog(DEFAULT_ITEMS)
    })

    return () => {
      unsubscribe()
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current)
      }
      stopCamera()
    }
  }, [])

  const handleStartScan = async () => {
    setError('')
    setNotice('')

    if (scanning) return

    setCapturedImage('')
    setDetected(null)

    try {
      setCameraOn(true)
      setScanning(true)
      setNotice('Kamera Raspberry Pi siap. Ambil gambar untuk memulai inferensi YOLO.')

      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current)
      }

      const updateStreamFrame = () => {
        setRemoteStreamUrl(`${RECOGNITION_URL}/api/snapshot?ts=${Date.now()}`)
      }

      updateStreamFrame()
      streamIntervalRef.current = setInterval(updateStreamFrame, 100)
    } catch {
      setError('Kamera Raspberry Pi tidak bisa dijangkau saat ini.')
      stopCamera()
    }
  }

  const handleCaptureImage = async () => {
    setError('')
    setNotice('')

    if (!cameraOn) {
      setError('Hubungkan dulu ke kamera Raspberry Pi sebelum mengambil gambar.')
      return
    }

    setRecognizing(true)
    setNotice('Mengambil gambar dari kamera Raspberry Pi...')

    try {
      const snapshotResponse = await fetch(`${RECOGNITION_URL}/api/snapshot`)
      if (!snapshotResponse.ok) {
        throw new Error('Gagal mengambil gambar dari kamera Raspberry Pi.')
      }

      const blob = await snapshotResponse.blob()
      const imageUrl = URL.createObjectURL(blob)
      setCapturedImage(imageUrl)
      setScanning(false)

      const formData = new FormData()
      formData.append('image', blob, 'capture.jpg')

      const response = await fetch(`${RECOGNITION_URL}/api/recognize`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses gambar dengan YOLO.')
      }

      const detection = data.best_detection || data.detections?.[0] || null
      if (!detection) {
        throw new Error('Tidak ada objek yang terdeteksi oleh YOLO.')
      }

      // ... di dalam fungsi handleCaptureImage ...

// 1. Ubah resolusi ini sesuai dengan input model YOLO (640x480)
// ... di dalam handleCaptureImage ...
const width = 640; 
const height = 480;

// Debug: cek koordinat asli dari Python
console.log("Koordinat asli:", detection.bounding_box);

const box = detection.bounding_box
  ? {
      // LOGIKA MIRROR:
      // Kita hitung posisi dari KIRI (x1) ke posisi KANAN (x2)
      // Karena gambar dibalik, x1 baru harus berasal dari x2 asli
      x: `${Math.max(0, Math.min(100, ((width - detection.bounding_box.x2) / width) * 100))}%`,
      y: `${Math.max(0, Math.min(100, (detection.bounding_box.y1 / height) * 100))}%`,
      w: `${Math.max(4, Math.min(100, ((detection.bounding_box.x2 - detection.bounding_box.x1) / width) * 100))}%`,
      h: `${Math.max(4, Math.min(100, ((detection.bounding_box.y2 - detection.bounding_box.y1) / height) * 100))}%`
    }
  : { x: '0%', y: '0%', w: '0%', h: '0%' };

  setDetected({
  name: detection.name || 'Peralatan',
  box: box,
  confidence: detection.confidence || 0,
  at: new Date().toLocaleTimeString('id-ID')
});

setNotice(`Deteksi YOLO berhasil: ${detection.name || 'Peralatan'} (${Math.round((detection.confidence || 0) * 100)}%)`);

console.log("Box yang dikirim ke UI:", box); // Debug: cek apakah angkanya masuk akal
      setNotice(`Deteksi YOLO berhasil: ${detection.name || detection.nama_komponen || detection.class_name || 'Peralatan'} (${Math.round((detection.confidence || 0) * 100)}%)`)
    } catch (err) {
      setError(err.message || 'Gagal memproses gambar dengan YOLO.')
    } finally {
      setRecognizing(false)
    }
  }

  const handleFinish = async () => {
    setError('')
    setNotice('')

    if (!detected) {
      setError('Belum ada hasil scan peralatan.')
      return
    }

    const parsedQty = parseInt(quantity, 10)
    if (Number.isNaN(parsedQty) || parsedQty < 1) {
      setError('Jumlah peralatan minimal 1.')
      return
    }

    try {
      setSaving(true)

      const partsRef = collection(db, 'parts')
      const matchedParts = await getDocs(
        query(partsRef, where('name', '==', detected.name))
      )

      if (matchedParts.empty) {
        setError('Komponen tidak ditemukan di daftar Komponen Laboratorium.')
        return
      }

      const partDoc = matchedParts.docs[0]
      const partData = partDoc.data()
      const canonicalComponentName = String(partData.name || detected.name || '').trim()
      const currentQuantity = Number(partData.quantity || 0)
      const nextQuantity = status === 'meminjam'
        ? Math.max(currentQuantity - parsedQty, 0)
        : currentQuantity + parsedQty

      if (status === 'meminjam' && parsedQty > currentQuantity) {
        setError(`Stok ${detected.name} tidak mencukupi.`)
        return
      }

      if (status === 'mengembalikan') {
        const borrowersRef = collection(db, 'borrowers')
        const matchedBorrowers = await getDocs(
          query(
            borrowersRef,
            where('nim', '==', student.nim || '-')
          )
        )

        const pendingBorrower = matchedBorrowers.docs.find((itemDoc) => {
          const data = itemDoc.data()
          return matchesComponentName(data.component, canonicalComponentName) && Boolean(data.returned) === false
        })

        if (!pendingBorrower) {
          setError('Data peminjaman yang belum dikembalikan tidak ditemukan.')
          return
        }

        await updateDoc(doc(db, 'borrowers', pendingBorrower.id), {
          returned: true
        })
      } else {
        await addDoc(collection(db, 'borrowers'), {
          nim: student.nim || '-',
          name: student.name || 'Mahasiswa',
          prodi: student.prodi || '-',
          borrowDate: new Date().toISOString().slice(0, 10),
          component: canonicalComponentName,
          quantity: parsedQty,
          returned: false,
          hidden: false,
          actionType: status,
          studentEmail: student.email || '-',
          createdAt: serverTimestamp()
        })
      }

      await updateDoc(doc(db, 'parts', partDoc.id), {
        quantity: nextQuantity
      })

      try {
        await handlePrepareExit(status, canonicalComponentName)
        setNotice('Data scan berhasil disimpan. Silakan tempelkan fingerprint sekali lagi untuk membuka pintu keluar.')
      } catch (doorError) {
        setNotice(`Data scan berhasil disimpan, tetapi mode fingerprint keluar gagal disiapkan: ${doorError.message}`)
      }
      setDetected(null)
      setQuantity('1')
      setStatus('meminjam')
      stopCamera()
    } catch {
      setError('Gagal menyimpan data scan ke database. Cek rules borrowers.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 p-2 sm:p-3">
      <div className="flex h-full min-h-0 w-full max-w-[1760px] mx-auto flex-col gap-3 sm:gap-4">
        <div className="rounded-2xl border border-indigo-500/40 bg-slate-900/90 px-4 py-4 sm:px-6 sm:py-5 shadow-xl shrink-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-indigo-100">Dashboard Mahasiswa - Smart Lab Access</h1>
          <p className="mt-1 text-xs sm:text-sm md:text-base text-slate-300">Alur: 1. Pilih status 2. Mulai scan 3. Pantau live kamera 4. Isi jumlah 5. Selesai simpan 6. Fingerprint keluar.</p>
          <p className="mt-2 text-xs sm:text-sm text-cyan-300 font-semibold">Login sebagai: {student.name} ({student.nim || '-'})</p>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[360px_1fr] gap-3 sm:gap-4 xl:gap-5 items-stretch overflow-hidden">
          <aside className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 shadow-xl overflow-hidden">
            <div className="space-y-2 rounded-2xl border border-slate-700 bg-slate-800/70 p-4 sm:p-5">
              <p className="text-sm sm:text-base uppercase tracking-[0.16em] text-slate-200 font-bold">1. Pilih Status</p>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm sm:text-base font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="meminjam">Meminjam Peralatan</option>
                <option value="mengembalikan">Mengembalikan Peralatan</option>
              </select>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/70 p-4 sm:p-5">
              <p className="text-sm sm:text-base uppercase tracking-[0.16em] text-slate-200 font-bold">2. Mulai Scanning</p>
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartScan}
                  disabled={recognizing}
                  className="flex w-full max-w-[240px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm sm:text-base font-bold text-white hover:bg-indigo-500 transition-colors disabled:opacity-70"
                >
                  <Play size={16} className="shrink-0" />
                  Mulai
                </button>
                <button
                  type="button"
                  onClick={handleCaptureImage}
                  disabled={recognizing || !cameraOn}
                  className="flex w-full max-w-[240px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm sm:text-base font-bold text-white hover:bg-indigo-500 transition-colors disabled:opacity-70"
                >
                  <Camera size={16} className="shrink-0" />
                  Mengambil Gambar
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  disabled={recognizing}
                  className="flex w-full max-w-[240px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm sm:text-base font-bold text-white hover:bg-indigo-500 transition-colors disabled:opacity-70"
                >
                  <Square size={16} className="shrink-0" />
                  Stop Kamera
                </button>
                {capturedImage && (
                  <p className="text-[11px] font-semibold text-cyan-300">Gambar terakhir sudah diambil.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 sm:p-5 space-y-3">
              <p className="text-sm sm:text-base uppercase tracking-[0.16em] text-slate-200 font-bold">4. Input Jumlah</p>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm sm:text-base font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />

              <button
                type="button"
                disabled={saving}
                onClick={handleFinish}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm sm:text-base font-bold text-white hover:bg-emerald-500 disabled:opacity-70"
              >
                <CheckCircle2 size={16} />
                {saving ? 'Menyimpan...' : 'Selesai'}
              </button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-col gap-3 sm:gap-4 overflow-hidden">
            <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5 md:p-6 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-4">
                <p className="text-sm sm:text-base md:text-lg uppercase tracking-[0.16em] text-slate-200 font-bold">3. Live Kamera Scanner</p>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cameraOn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                  {cameraOn ? 'Kamera Aktif' : 'Kamera Belum Aktif'}
                </span>
              </div>

              <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-700 bg-black min-h-[0]">
                <div className="absolute inset-0">
                  {capturedImage ? (
                    <img src={capturedImage} alt="Hasil tangkapan kamera" className="w-full h-full object-cover scale-x-[-1]" />
                  ) : remoteStreamUrl ? (
                    <img src={remoteStreamUrl} alt="Live kamera Raspberry Pi" className="w-full h-full object-cover scale-x-[-1]" />
                  ) : null}

                  {!cameraOn && !capturedImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2">
                      <Camera size={28} />
                      <p className="text-sm sm:text-base md:text-lg font-semibold">Tekan "Mulai" untuk menyalakan live kamera</p>
                    </div>
                  )}

                  {capturedImage && (
                    <div className="absolute inset-0 flex items-end justify-start p-4">
                      <div className="rounded-lg bg-slate-950/70 px-3 py-2 text-xs font-semibold text-cyan-200">
                        Gambar sudah diambil dan dibekukan.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5 md:p-6 shadow-xl shrink-0">
              <p className="text-sm sm:text-base md:text-lg uppercase tracking-[0.16em] text-slate-200 font-bold">Hasil Scanning</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 min-h-[84px]">
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="text-sm font-bold text-slate-100 capitalize">{status}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 min-h-[84px]">
                  <p className="text-xs text-slate-400">Peralatan Terdeteksi</p>
                  <p className="text-sm font-bold text-cyan-300">{detected?.name || '-'}</p>
                </div>
              </div>

              {scanning && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-indigo-300">
                  <ScanLine size={14} />
                  YOLOv11 scanning berjalan real-time...
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">
                  {error}
                </div>
              )}

              {notice && (
                <div className="mt-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300">
                  {notice}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

export default StudentPortalPage
