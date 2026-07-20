import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { orderService } from '../services/orderService'
import { restaurantService, type PartnershipApplication } from '../services/restaurantService'
import api from '../services/api'
import type { Order, CourierInfo, PagedResult } from '../types'

const statusLabels: Record<string, string> = {
  Pending: 'Bekliyor', Assigned: 'Atandı', Picked: 'Yolda',
  Delivered: 'Teslim', Failed: 'İptal',
}
const statusColors: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  Assigned: 'bg-blue-100 text-blue-800',
  Picked: 'bg-purple-100 text-purple-800',
  Delivered: 'bg-green-100 text-green-800',
  Failed: 'bg-red-100 text-red-800',
}
const courierStatusColors: Record<string, string> = {
  Available: 'bg-green-100 text-green-700',
  Busy: 'bg-purple-100 text-purple-700',
  Offline: 'bg-gray-100 text-gray-500',
}
const appStatusConfig: Record<string, { label: string; cls: string }> = {
  Pending:  { label: 'Bekliyor',   cls: 'bg-amber-100 text-amber-800' },
  Approved: { label: 'Onaylandı',  cls: 'bg-green-100 text-green-800' },
  Rejected: { label: 'Reddedildi', cls: 'bg-red-100 text-red-800' },
}

export default function AdminPage() {
  const [tab, setTab] = useState<'orders' | 'couriers' | 'applications'>('orders')
  const [orders, setOrders] = useState<PagedResult<Order> | null>(null)
  const [couriers, setCouriers] = useState<CourierInfo[]>([])
  const [applications, setApplications] = useState<PartnershipApplication[]>([])
  const [appFilter, setAppFilter] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, pageSize: 15 }
      if (statusFilter) params.status = statusFilter
      const res = await orderService.getAdminOrders(params)
      setOrders(res)
    } finally { setLoading(false) }
  }

  const fetchCouriers = async () => {
    setLoading(true)
    try {
      const res = await api.get<CourierInfo[]>('/admin/couriers')
      setCouriers(res.data)
    } finally { setLoading(false) }
  }

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const res = await restaurantService.getApplications(appFilter || undefined)
      setApplications(res)
    } finally { setLoading(false) }
  }

  useEffect(() => { if (tab === 'orders') fetchOrders() }, [tab, page, statusFilter])
  useEffect(() => { if (tab === 'couriers') fetchCouriers() }, [tab])
  useEffect(() => { if (tab === 'applications') fetchApplications() }, [tab, appFilter])

  const handleReview = async (id: string, decision: 'approve' | 'reject') => {
    try {
      await restaurantService.reviewApplication(id, decision, reviewNote || undefined)
      setReviewingId(null)
      setReviewNote('')
      fetchApplications()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      alert(e?.response?.data?.message ?? 'Bir hata oluştu.')
    }
  }

  const toggleCourierStatus = async (id: string, current: string) => {
    const newStatus = current === 'Offline' ? 'available' : 'offline'
    await api.patch(`/admin/couriers/${id}`, { status: newStatus })
    fetchCouriers()
  }

  const totalPages = orders ? Math.ceil(orders.totalCount / 15) : 1

  return (
    <div className="min-h-screen bg-[#efe6dd]">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a2e]">Admin Paneli</h1>
          <div className="flex gap-2">
            {(['orders', 'couriers', 'applications'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition relative ${
                  tab === t
                    ? 'bg-[#9a0002] text-white shadow-sm'
                    : 'bg-white text-[#4a4a6a] border border-[#e0d6cc] hover:border-[#9a0002]'
                }`}
              >
                {t === 'orders' ? '📋 Siparişler' : t === 'couriers' ? '🛵 Kuryeler' : '🏪 Başvurular'}
                {t === 'applications' && applications.filter(a => a.status === 'Pending').length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {applications.filter(a => a.status === 'Pending').length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* SİPARİŞLER */}
        {tab === 'orders' && (
          <div className="bg-white rounded-2xl border border-[#e0d6cc] overflow-hidden">
            {/* Filtre */}
            <div className="px-5 py-4 border-b border-[#ece4db] flex gap-3 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-xl border border-[#d4c9be] bg-[#faf7f4] text-sm text-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#9a0002]/30 focus:border-[#9a0002]"
              >
                <option value="">Tüm Durumlar</option>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button
                onClick={() => { setStatusFilter(''); setPage(1) }}
                className="px-3 py-2 rounded-xl border border-[#d4c9be] text-sm text-[#9a8f85] hover:border-[#9a0002] hover:text-[#9a0002] transition"
              >
                Sıfırla
              </button>
              {orders && (
                <span className="ml-auto text-sm text-[#9a8f85] self-center">
                  {orders.totalCount} sipariş
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-16 text-center text-[#9a8f85]">Yükleniyor...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#faf7f4] text-[#9a8f85] text-xs uppercase tracking-wide">
                      <th className="px-5 py-3 text-left">Sipariş ID</th>
                      <th className="px-5 py-3 text-left">Adres</th>
                      <th className="px-5 py-3 text-left">Durum</th>
                      <th className="px-5 py-3 text-left">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e8e0]">
                    {orders?.items.map(o => (
                      <tr key={o.id} className="hover:bg-[#faf7f4] transition">
                        <td className="px-5 py-3.5 font-mono text-xs text-[#9a8f85]">
                          {o.id.slice(0, 8)}...
                        </td>
                        <td className="px-5 py-3.5 text-[#1a1a2e] max-w-[200px] truncate">
                          {o.deliveryAddress}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {statusLabels[o.status] ?? o.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[#9a8f85] text-xs">
                          {new Date(o.createdAt).toLocaleString('tr-TR')}
                        </td>
                      </tr>
                    ))}
                    {(!orders?.items.length) && (
                      <tr><td colSpan={4} className="px-5 py-12 text-center text-[#9a8f85]">Sipariş bulunamadı</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sayfalama */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-[#ece4db] flex items-center justify-between">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-xl border border-[#d4c9be] text-sm disabled:opacity-40 hover:border-[#9a0002] transition"
                >
                  ← Önceki
                </button>
                <span className="text-sm text-[#9a8f85]">Sayfa {page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-xl border border-[#d4c9be] text-sm disabled:opacity-40 hover:border-[#9a0002] transition"
                >
                  Sonraki →
                </button>
              </div>
            )}
          </div>
        )}

        {/* KURYELER */}
        {tab === 'couriers' && (
          <div className="bg-white rounded-2xl border border-[#e0d6cc] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#ece4db] flex justify-between items-center">
              <span className="text-sm text-[#9a8f85]">{couriers.length} kurye</span>
              <button onClick={fetchCouriers} className="text-sm text-[#9a0002] hover:underline">
                Yenile
              </button>
            </div>
            {loading ? (
              <div className="py-16 text-center text-[#9a8f85]">Yükleniyor...</div>
            ) : (
              <div className="divide-y divide-[#f0e8e0]">
                {couriers.map(c => (
                  <div key={c.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#faf7f4] transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#efe6dd] flex items-center justify-center text-lg">
                        🛵
                      </div>
                      <div>
                        <p className="font-medium text-[#1a1a2e] text-sm">{c.fullName}</p>
                        <p className="text-xs text-[#9a8f85]">
                          {c.currentLocation
                            ? `${c.currentLocation.latitude.toFixed(4)}, ${c.currentLocation.longitude.toFixed(4)}`
                            : 'Konum yok'}
                          {c.lastLocationAt && ` · ${new Date(c.lastLocationAt).toLocaleTimeString('tr-TR')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${courierStatusColors[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {c.status === 'Available' ? 'Müsait' : c.status === 'Busy' ? 'Meşgul' : 'Çevrimdışı'}
                      </span>
                      <button
                        onClick={() => toggleCourierStatus(c.id, c.status)}
                        className="text-xs px-3 py-1.5 rounded-xl border border-[#d4c9be] hover:border-[#9a0002] hover:text-[#9a0002] transition"
                      >
                        {c.status === 'Offline' ? 'Aktif Et' : 'Pasif Et'}
                      </button>
                    </div>
                  </div>
                ))}
                {!couriers.length && (
                  <div className="py-12 text-center text-[#9a8f85]">Kurye bulunamadı</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* BAŞVURULAR */}
        {tab === 'applications' && (
          <div className="bg-white rounded-2xl border border-[#e0d6cc] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#ece4db] flex gap-3 items-center flex-wrap">
              <select value={appFilter} onChange={e => setAppFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#d4c9be] bg-[#faf7f4] text-sm text-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#9a0002]/30">
                <option value="">Tüm Başvurular</option>
                <option value="Pending">Bekleyenler</option>
                <option value="Approved">Onaylananlar</option>
                <option value="Rejected">Reddedilenler</option>
              </select>
              <span className="ml-auto text-sm text-[#9a8f85]">{applications.length} başvuru</span>
              <button onClick={fetchApplications} className="text-sm text-[#9a0002] hover:underline">Yenile</button>
            </div>
            {loading ? (
              <div className="py-16 text-center text-[#9a8f85]">Yükleniyor...</div>
            ) : (
              <div className="divide-y divide-[#f0e8e0]">
                {applications.map(app => {
                  const st = appStatusConfig[app.status] ?? { label: app.status, cls: 'bg-gray-100 text-gray-600' }
                  const isReviewing = reviewingId === app.id
                  return (
                    <div key={app.id} className="px-5 py-4 hover:bg-[#faf7f4] transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[#1a1a2e]">{app.restaurantName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                          </div>
                          <p className="text-sm text-[#4a4a6a]">{app.ownerName} · {app.email} · {app.phone}</p>
                          <p className="text-xs text-[#9a8f85] mt-0.5">{app.address}, {app.city} · {app.category}</p>
                          {app.description && <p className="text-xs text-[#9a8f85] mt-1 italic">"{app.description}"</p>}
                          <p className="text-xs text-[#9a8f85] mt-1">{new Date(app.createdAt).toLocaleString('tr-TR')}</p>
                          {app.adminNote && (
                            <p className="text-xs mt-1 px-2 py-1 rounded bg-[#fff3e0] text-[#b45309]">Not: {app.adminNote}</p>
                          )}
                        </div>
                        {app.status === 'Pending' && !isReviewing && (
                          <button onClick={() => setReviewingId(app.id)}
                            className="text-xs px-3 py-1.5 rounded-xl border border-[#d4c9be] hover:border-[#9a0002] hover:text-[#9a0002] transition flex-shrink-0">
                            İncele
                          </button>
                        )}
                      </div>
                      {isReviewing && (
                        <div className="mt-3 border-t border-[#f0e8e0] pt-3">
                          <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                            rows={2} placeholder="Admin notu (opsiyonel)"
                            className="w-full border border-[#d4c9be] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#9a0002] mb-2 resize-none" />
                          <div className="flex gap-2">
                            <button onClick={() => handleReview(app.id, 'approve')}
                              className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition">
                              ✓ Onayla
                            </button>
                            <button onClick={() => handleReview(app.id, 'reject')}
                              className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition">
                              ✕ Reddet
                            </button>
                            <button onClick={() => { setReviewingId(null); setReviewNote('') }}
                              className="px-4 py-2 rounded-xl border border-[#d4c9be] text-sm hover:border-[#9a0002] transition">
                              İptal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {!applications.length && <div className="py-12 text-center text-[#9a8f85]">Başvuru bulunamadı</div>}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
