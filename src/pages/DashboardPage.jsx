import React, { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { TrendingUp, Users, Package, AlertCircle } from 'lucide-react'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { collection, getFirestore, onSnapshot } from 'firebase/firestore'
import firebaseConfig from '../firebaseConfig'

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
const db = getFirestore(app)

const DashboardPage = () => {
  const [borrowers, setBorrowers] = useState([])

  useEffect(() => {
    const borrowersRef = collection(db, 'borrowers')

    const unsubscribe = onSnapshot(borrowersRef, (snapshot) => {
      const items = snapshot.docs.map((borrowerDoc) => {
        const data = borrowerDoc.data()

        return {
          id: borrowerDoc.id,
          returned: Boolean(data.returned),
          hidden: Boolean(data.hidden)
        }
      })

      setBorrowers(items)
    })

    return () => unsubscribe()
  }, [])

  const visibleBorrowers = borrowers.filter((borrower) => !borrower.hidden)
  const dataPeminjam = visibleBorrowers.filter((borrower) => !borrower.returned).length
  const dataPengembalian = visibleBorrowers.filter((borrower) => borrower.returned).length
  const totalTransaksi = visibleBorrowers.length
  const data = [
    {
      name: 'Data Peminjam',
      value: dataPeminjam,
      color: '#60A5FA'
    },
    {
      name: 'Data Pengembalian',
      value: dataPengembalian,
      color: '#86EFAC'
    }
  ]

  const totalBorrowers = totalTransaksi || 1
  const borrowingPercentage = totalTransaksi ? ((dataPeminjam / totalTransaksi) * 100).toFixed(1) : '0.0'
  const returnedPercentage = totalTransaksi ? ((dataPengembalian / totalTransaksi) * 100).toFixed(1) : '0.0'

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-blue-50 via-white to-blue-50 min-h-screen">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold gradient-text mb-2">Dashboard Monitoring</h1>
        <p className="text-gray-600 font-medium text-sm sm:text-base">Statistik peminjaman komponen laboratorium secara real-time</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card 1 - Data Peminjam */}
        <div className="glass rounded-2xl shadow-lg p-4 sm:p-6 backdrop-blur-xl border border-white border-opacity-40 hover:shadow-xl transition-shadow group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Data Peminjam</p>
              <p className="text-4xl font-bold text-sky-500">{dataPeminjam}</p>
              <p className="text-sky-500 font-semibold text-sm mt-2">{borrowingPercentage}% dari total</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-sky-300 to-blue-400 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
          </div>
          <div className="mt-4 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-sky-300 to-blue-400" style={{ width: `${borrowingPercentage}%` }}></div>
          </div>
        </div>

        {/* Card 2 - Data Pengembalian */}
        <div className="glass rounded-2xl shadow-lg p-4 sm:p-6 backdrop-blur-xl border border-white border-opacity-40 hover:shadow-xl transition-shadow group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Data Pengembalian</p>
              <p className="text-4xl font-bold text-green-500">{dataPengembalian}</p>
              <p className="text-green-500 font-semibold text-sm mt-2">{returnedPercentage}% dari total</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-green-300 to-emerald-400 rounded-xl text-white group-hover:scale-110 transition-transform">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="mt-4 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-300 to-emerald-400" style={{ width: `${returnedPercentage}%` }}></div>
          </div>
        </div>

        {/* Card 3 - Total Transaksi */}
        <div className="glass rounded-2xl shadow-lg p-4 sm:p-6 backdrop-blur-xl border border-white border-opacity-40 hover:shadow-xl transition-shadow group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Total Transaksi</p>
              <p className="text-4xl font-bold text-blue-600">{totalTransaksi}</p>
              <p className="text-blue-600 font-semibold text-sm mt-2">100% transaksi</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Package size={24} />
            </div>
          </div>
          <div className="mt-4 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: '100%' }}></div>
          </div>
        </div>

      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
        {/* Pie Chart */}
        <div className="lg:col-span-1 glass rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 backdrop-blur-xl border border-white border-opacity-40">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Distribusi Peminjaman</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => value} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stats Details */}
        <div className="lg:col-span-2 glass rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 backdrop-blur-xl border border-white border-opacity-40">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Detail Statistik</h2>
          <div className="space-y-4 max-w-2xl">
            {data.map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-white bg-opacity-50 rounded-xl hover:bg-opacity-100 transition-all">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 mb-2">{item.name}</p>
                  <div className="flex items-center gap-4">
                    <div className="w-32 sm:w-48 md:w-56 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${totalTransaksi ? (item.value / totalTransaksi) * 100 : 0}%`,
                          backgroundColor: item.color
                        }}
                      ></div>
                    </div>
                    <div className="text-left min-w-[52px]">
                      <p className="text-xl font-bold leading-5" style={{ color: item.color }}>{item.value}</p>
                      <p className="text-xs text-gray-600">orang</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="glass rounded-2xl shadow-lg p-6 backdrop-blur-xl border border-white border-opacity-40 flex items-start gap-4">
        <div className="p-3 bg-blue-100 rounded-lg flex-shrink-0">
          <AlertCircle className="text-blue-600" size={24} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">📊 Informasi Dashboard</h3>
          <p className="text-gray-600 text-sm">
            Dashboard ini menampilkan statistik real-time peminjaman komponen laboratorium. Anda dapat melihat jumlah orang yang sedang meminjam dan yang sudah mengembalikan komponen dalam bentuk diagram interaktif. Data diperbarui secara otomatis setiap transaksi.
          </p>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
