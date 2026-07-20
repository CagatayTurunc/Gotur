import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { orderService } from '../services/orderService'
import { restaurantService, type MenuItem } from '../services/restaurantService'
import api from '../services/api'
import type { Order } from '../types'

type NavTab = 'dashboard' | 'orders' | 'menu' | 'analytics' | 'settings'

const statusConfig: Record<string, { label: string; cls: string }> = {
  Pending:   { label: 'Hazırlanıyor',     cls: 'bg-[#fff3e0] text-[#b45309] border border-[#f6d28d]' },
  Assigned:  { label: 'Kurye Bekleniyor', cls: 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]' },
  Picked:    { label: 'Teslim Alındı',    cls: 'bg-[#e8eaf6] text-[#3949ab] border border-[#c5cae9]' },
  Delivered: { label: 'Tamamlandı',       cls: 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]' },
  Failed:    { label: 'İptal',            cls: 'bg-[#fce8e6] text-[#c5221f] border border-[#f5c6c4]' },
}

// TOP_ITEMS artık dinamik — aşağıda orders + menuItems'dan hesaplanır

export default function RestaurantPage() {
  const navigate = useNavigate()
  const user = authService.getUser()

  const [activeTab, setActiveTab]   = useState<NavTab>('dashboard')
  const [isOpen, setIsOpen]         = useState(true)
  const [orders, setOrders]         = useState<Order[]>([])
  const [loading, setLoading]       = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Menü state
  const [restaurantId, setRestaurantId]       = useState<string | null>(null)
  const [restaurantName, setRestaurantName]   = useState('')
  const [restaurantAddress, setRestaurantAddress] = useState('')
  const [restaurantDesc, setRestaurantDesc]   = useState('')
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState('')
  const [restaurantIsOpen, setRestaurantIsOpen] = useState(true)
  const [menuItems, setMenuItems]         = useState<MenuItem[]>([])
  const [menuLoading, setMenuLoading]     = useState(false)
  const [showMenuForm, setShowMenuForm]   = useState(false)
  const [editingItem, setEditingItem]     = useState<MenuItem | null>(null)
  const [menuError, setMenuError]         = useState('')
  const [menuForm, setMenuForm] = useState({
    name: '', description: '', price: '', category: '', imageUrl: '', isAvailable: true,
  })

  // ── Siparişler ────────────────────────────────────────────
  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await orderService.getOrders({ page: 1, pageSize: 50 })
      setOrders(res.items)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    fetchOrders()
    intervalRef.current = setInterval(fetchOrders, 10_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // ── Restoran bilgilerini yükle ───────────────────────────
  useEffect(() => {
    api.get<{ id: string; name?: string; address?: string; description?: string; logoUrl?: string; isOpen?: boolean }>('/restaurants/mine')
      .then(r => {
        setRestaurantId(r.data?.id ?? null)
        setRestaurantName(r.data?.name ?? '')
        setRestaurantAddress(r.data?.address ?? '')
        setRestaurantDesc(r.data?.description ?? '')
        setRestaurantLogoUrl(r.data?.logoUrl ?? '')
        setRestaurantIsOpen(r.data?.isOpen ?? true)
        setIsOpen(r.data?.isOpen ?? true)
      })
      .catch(() => {})
  }, [])

  // ── Menü ─────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'menu' && restaurantId) fetchMenu()
  }, [activeTab, restaurantId])

  const fetchMenu = async () => {
    if (!restaurantId) return
    setMenuLoading(true)
    try { setMenuItems(await restaurantService.getMenuItems(restaurantId)) }
    finally { setMenuLoading(false) }
  }

  const openNewItem = () => {
    setEditingItem(null)
    setMenuForm({ name: '', description: '', price: '', category: '', imageUrl: '', isAvailable: true })
    setMenuError('')
    setShowMenuForm(true)
  }

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item)
    setMenuForm({ name: item.name, description: item.description ?? '', price: String(item.price), category: item.category ?? '', imageUrl: item.imageUrl ?? '', isAvailable: item.isAvailable })
    setMenuError('')
    setShowMenuForm(true)
  }

  const handleMenuSave = async () => {
    if (!restaurantId || !menuForm.name || !menuForm.price) { setMenuError('Ürün adı ve fiyat zorunludur.'); return }
    const price = parseFloat(menuForm.price)
    if (isNaN(price) || price <= 0) { setMenuError('Geçerli bir fiyat girin.'); return }
    setMenuError('')
    try {
      const payload = { name: menuForm.name, description: menuForm.description || undefined, price, category: menuForm.category || undefined, imageUrl: menuForm.imageUrl || undefined, isAvailable: menuForm.isAvailable }
      if (editingItem) await restaurantService.updateMenuItem(restaurantId, editingItem.id, payload)
      else await restaurantService.createMenuItem(restaurantId, payload)
      setShowMenuForm(false)
      fetchMenu()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setMenuError(e?.response?.data?.message ?? 'Bir hata oluştu.')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!restaurantId || !confirm('Bu ürünü silmek istiyor musunuz?')) return
    try { await restaurantService.deleteMenuItem(restaurantId, itemId); fetchMenu() } catch {}
  }

  const handleLogout = () => { authService.logout(); navigate('/') }

  const active    = orders.filter(o => ['Pending', 'Assigned'].includes(o.status))
  const pickedUp  = orders.filter(o => o.status === 'Picked')
  const delivered = orders.filter(o => o.status === 'Delivered')

  // ── En Çok Satanlar — tüm siparişlerden item frekansı hesapla ──────────────
  const topItems = (() => {
    const counts: Record<string, { qty: number; price: number }> = {}
    orders.forEach(o => o.items.forEach(i => {
      if (!counts[i.name]) counts[i.name] = { qty: 0, price: i.price }
      counts[i.name].qty += i.quantity
    }))
    return Object.entries(counts)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 3)
      .map(([name, data]) => {
        const menuItem = menuItems.find(m => m.name === name)
        return {
          name,
          orders: data.qty,
          price: `${data.price.toFixed(0)} ₺`,
          img: menuItem?.imageUrl ?? null,
        }
      })
  })()
  const liveOrders = orders.filter(o => ['Pending', 'Assigned', 'Picked'].includes(o.status))
  const totalSales = delivered.reduce((s, o) => s + o.items.reduce((a, i) => a + i.price * i.quantity, 0), 0)

  const handleMarkReady = async (id: string) => {
    try { await orderService.updateStatus(id, 'Assigned'); fetchOrders() } catch {}
  }

  const navItems: { key: NavTab; icon: string; label: string }[] = [
    { key: 'dashboard', icon: 'dashboard',      label: 'Dashboard' },
    { key: 'orders',    icon: 'receipt_long',    label: 'Siparişler' },
    { key: 'menu',      icon: 'restaurant_menu', label: 'Menü Yönetimi' },
    { key: 'analytics', icon: 'analytics',       label: 'Analitik' },
    { key: 'settings',  icon: 'settings',        label: 'Ayarlar' },
  ]

  // ── Menü kategorileri ─────────────────────────────────────
  const categories = Array.from(new Set(menuItems.map(m => m.category).filter(Boolean))) as string[]

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#fff8f6', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Sidebar ── */}
      <nav className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 z-40 py-6" style={{ backgroundColor: '#fff0ee' }}>
        <div className="px-4 mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-2xl font-black text-[#6f0001]" style={{ backgroundColor: '#f9dcd7' }}>
            {user?.fullName?.charAt(0).toUpperCase() ?? 'R'}
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight" style={{ color: '#6f0001' }}>{user?.fullName ?? 'Restoran'}</h1>
            <p className="text-xs mt-0.5" style={{ color: '#5b403c' }}>Partner Dashboard</p>
          </div>
        </div>

        <div className="flex-1 px-2">
          <ul className="space-y-1">
            {navItems.map(item => (
              <li key={item.key}>
                <button onClick={() => setActiveTab(item.key)}
                  className="w-full flex items-center gap-4 px-4 py-2.5 text-sm font-semibold transition-all duration-200 rounded-r-full text-left"
                  style={activeTab === item.key ? { color: '#6f0001', backgroundColor: '#ffe2dd', borderRight: '4px solid #6f0001' } : { color: '#5b403c' }}
                  onMouseEnter={e => { if (activeTab !== item.key) e.currentTarget.style.backgroundColor = '#f9dcd7' }}
                  onMouseLeave={e => { if (activeTab !== item.key) e.currentTarget.style.backgroundColor = 'transparent' }}>
                  <span className="material-symbols-outlined text-[22px]"
                    style={{ fontVariationSettings: activeTab === item.key ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-4 mt-auto space-y-2">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ backgroundColor: '#f9dcd7', color: '#6f0001' }}>
            <span className="material-symbols-outlined text-[18px]">support_agent</span>
            Destek Merkezi
          </button>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium hover:bg-red-50"
            style={{ color: '#c5221f' }}>
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Çıkış Yap
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">

        {/* Header */}
        <header className="w-full h-16 sticky top-0 z-50 flex items-center justify-between px-4 lg:px-6 border-b"
          style={{ backgroundColor: '#ffffff', borderColor: '#f9dcd7', boxShadow: '0 1px 4px rgba(32,16,0,0.06)' }}>
          <div className="flex items-center gap-3 md:hidden">
            <span className="font-bold text-lg" style={{ color: '#6f0001' }}>Götür Partner</span>
          </div>
          <div className="hidden md:flex items-center">
            <h2 className="font-bold text-xl" style={{ color: '#271815' }}>
              {navItems.find(n => n.key === activeTab)?.label ?? 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: '#f9dcd7' }}>
              <span className="text-xs font-medium" style={{ color: '#5b403c' }}>Durum:</span>
              <button onClick={() => setIsOpen(v => !v)}
                className="relative inline-flex items-center w-10 h-5 rounded-full transition-colors duration-200"
                style={{ backgroundColor: isOpen ? '#6f0001' : '#c6c6c7' }}>
                <span className="absolute w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                  style={{ transform: isOpen ? 'translateX(22px)' : 'translateX(2px)' }} />
              </button>
              <span className="text-xs font-semibold" style={{ color: isOpen ? '#6f0001' : '#5b403c' }}>
                {isOpen ? 'Açık' : 'Kapalı'}
              </span>
            </div>
            <button className="p-2 rounded-full hover:opacity-80" style={{ color: '#6f0001' }}>
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 rounded-full hover:opacity-80" style={{ color: '#6f0001' }}>
              <span className="material-symbols-outlined">account_circle</span>
            </button>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="p-4 lg:p-6 flex-1">

          {/* ═══════════ DASHBOARD ═══════════ */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Başlık */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
                <div>
                  <h2 className="text-2xl font-black" style={{ color: '#271815' }}>Hoş Geldiniz, {user?.fullName ?? 'Restoran'}!</h2>
                  <p className="text-sm mt-0.5" style={{ color: '#5b403c' }}>Bugün restoranınızda neler oluyor bir bakın.</p>
                </div>
                <div className="flex items-center gap-2 border rounded-full px-4 py-2 bg-white text-sm"
                  style={{ borderColor: '#e4beb8', boxShadow: '0 2px 6px rgba(32,16,0,0.05)' }}>
                  <span className="material-symbols-outlined text-[18px]" style={{ color: '#5d5f5f' }}>calendar_today</span>
                  <span className="font-semibold text-sm" style={{ color: '#271815' }}>
                    {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  <button onClick={fetchOrders} className={`ml-1 text-[#6f0001] hover:opacity-70 ${loading ? 'animate-spin' : ''}`}>
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                  </button>
                </div>
              </div>

              {/* Metrik Kartlar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Bugünkü Satış', icon: 'payments', value: totalSales > 0 ? `${totalSales.toFixed(0)} ₺` : '—', sub: '+15% dünden' },
                  { label: 'Aktif Sipariş', icon: 'local_mall', value: String(active.length + pickedUp.length), sub: `${pickedUp.length} teslim alındı`, accent: true },
                  { label: 'Restoran Puanı', icon: 'star', value: '4.8', sub: '1000+ değerlendirme' },
                  { label: 'Ort. Hazırlık', icon: 'timer', value: '18 dk', sub: 'Hedef sürede' },
                ].map((card) => (
                  <div key={card.label} className={`bg-white rounded-xl p-4 flex flex-col justify-between ${card.accent ? 'border-l-4 border-[#6f0001]' : ''}`}
                    style={{ boxShadow: '0 2px 12px rgba(32,16,0,0.06)' }}>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5b403c' }}>{card.label}</span>
                      <div className="p-1.5 rounded-full" style={{ backgroundColor: '#f9dcd7' }}>
                        <span className="material-symbols-outlined text-[20px]" style={{ color: '#6f0001', fontVariationSettings: card.icon === 'star' ? "'FILL' 1" : "'FILL' 0" }}>{card.icon}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-black" style={{ color: card.accent ? '#271815' : '#6f0001' }}>{card.value}</div>
                      <div className="text-xs mt-1" style={{ color: '#5b403c' }}>{card.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Canlı Siparişler + Top Items */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg" style={{ color: '#271815' }}>Canlı Siparişler</h3>
                    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />Canlı
                    </span>
                  </div>
                  <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(32,16,0,0.06)' }}>
                    {loading && !orders.length ? (
                      <div className="p-10 text-center text-sm" style={{ color: '#5b403c' }}>Yükleniyor...</div>
                    ) : liveOrders.length === 0 ? (
                      <div className="p-10 text-center text-sm" style={{ color: '#5b403c' }}>
                        <span className="material-symbols-outlined text-[40px] block mb-2 opacity-30">receipt_long</span>
                        Aktif sipariş yok
                      </div>
                    ) : (
                      <ul className="divide-y" style={{ borderColor: '#fff0ee' }}>
                        {liveOrders.map(o => {
                          const st = statusConfig[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600 border border-gray-200' }
                          const total = o.items.reduce((s, i) => s + i.price * i.quantity, 0)
                          const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000)
                          return (
                            <li key={o.id} className="p-4" style={{ opacity: o.status === 'Picked' ? 0.75 : 1 }}>
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold px-2 py-0.5 rounded text-[#271815]" style={{ backgroundColor: '#fff0ee' }}>
                                    #{o.id.slice(0, 6).toUpperCase()}
                                  </span>
                                  <span className="text-xs flex items-center gap-1" style={{ color: '#5b403c' }}>
                                    <span className="material-symbols-outlined text-[14px]">schedule</span>{mins} dk önce
                                  </span>
                                </div>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                              </div>
                              <div className="text-sm mb-2" style={{ color: '#271815' }}>
                                {o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold" style={{ color: '#6f0001' }}>₺{total.toFixed(2)}</span>
                                {o.status === 'Pending' && (
                                  <button onClick={() => handleMarkReady(o.id)}
                                    className="text-sm font-bold px-4 py-1.5 rounded-full text-white hover:opacity-80"
                                    style={{ backgroundColor: '#6f0001' }}>
                                    Hazır İşaretle
                                  </button>
                                )}
                                {o.status === 'Assigned' && (
                                  <span className="text-xs flex items-center gap-1" style={{ color: '#5b403c' }}>
                                    <span className="material-symbols-outlined text-[14px]">moped</span>Kurye bekleniyor
                                  </span>
                                )}
                                {o.status === 'Picked' && (
                                  <span className="text-xs flex items-center gap-1" style={{ color: '#5b403c' }}>
                                    <span className="material-symbols-outlined text-[14px]">local_shipping</span>Yolda
                                  </span>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 12px rgba(32,16,0,0.06)' }}>
                    <h3 className="font-bold text-base mb-4" style={{ color: '#271815' }}>En Çok Satanlar</h3>
                    {topItems.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: '#5b403c' }}>Henüz sipariş verisi yok</p>
                    ) : (
                      <ul className="space-y-4">
                        {topItems.map(item => (
                          <li key={item.name} className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-[#fff0ee] flex items-center justify-center">
                              {item.img ? (
                                <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-[28px]" style={{ color: '#e4beb8' }}>restaurant</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate" style={{ color: '#271815' }}>{item.name}</p>
                              <p className="text-xs" style={{ color: '#5b403c' }}>{item.orders} adet sipariş</p>
                            </div>
                            <span className="text-sm font-bold flex-shrink-0" style={{ color: '#6f0001' }}>{item.price}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button onClick={() => setActiveTab('menu')}
                      className="w-full mt-4 py-2 rounded-full text-sm font-semibold border hover:opacity-80 transition-opacity"
                      style={{ borderColor: '#6f0001', color: '#6f0001' }}>
                      Menüyü Yönet →
                    </button>
                  </div>
                  <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 2px 12px rgba(32,16,0,0.06)' }}>
                    <h4 className="font-bold text-sm mb-3" style={{ color: '#271815' }}>Bugün Tamamlananlar</h4>
                    {delivered.length === 0 ? (
                      <p className="text-xs text-center py-3" style={{ color: '#5b403c' }}>Henüz tamamlanan sipariş yok</p>
                    ) : (
                      <ul className="space-y-2">
                        {delivered.slice(0, 4).map(o => (
                          <li key={o.id} className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold" style={{ color: '#271815' }}>#{o.id.slice(0, 6).toUpperCase()}</span>
                            <span className="truncate max-w-[90px] mx-2" style={{ color: '#5b403c' }}>{o.deliveryAddress}</span>
                            <span className="font-semibold text-green-700">✓ Teslim</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ SİPARİŞLER ═══════════ */}
          {activeTab === 'orders' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black" style={{ color: '#271815' }}>Tüm Siparişler</h2>
                  <p className="text-sm mt-0.5" style={{ color: '#5b403c' }}>Aktif ve geçmiş siparişlerinizi görüntüleyin.</p>
                </div>
                <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border"
                  style={{ borderColor: '#e4beb8', color: '#6f0001' }}>
                  <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
                  Yenile
                </button>
              </div>
              <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(32,16,0,0.06)' }}>
                {loading && !orders.length ? (
                  <div className="p-16 text-center text-sm" style={{ color: '#5b403c' }}>Yükleniyor...</div>
                ) : orders.length === 0 ? (
                  <div className="p-16 text-center">
                    <span className="material-symbols-outlined text-[48px] block mb-3 opacity-20">receipt_long</span>
                    <p className="text-sm" style={{ color: '#5b403c' }}>Henüz sipariş yok.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: '#fff0ee' }}>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#5b403c' }}>Sipariş</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#5b403c' }}>Ürünler</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#5b403c' }}>Toplam</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#5b403c' }}>Durum</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#5b403c' }}>Tarih</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#5b403c' }}>İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: '#fff0ee' }}>
                        {orders.map(o => {
                          const st = statusConfig[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600 border border-gray-200' }
                          const total = o.items.reduce((s, i) => s + i.price * i.quantity, 0)
                          return (
                            <tr key={o.id} className="hover:bg-[#fffaf9] transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#fff0ee', color: '#271815' }}>
                                  #{o.id.slice(0, 6).toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 max-w-[200px]">
                                <p className="text-xs truncate" style={{ color: '#271815' }}>
                                  {o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm font-bold" style={{ color: '#6f0001' }}>₺{total.toFixed(2)}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                              </td>
                              <td className="px-4 py-3 text-xs" style={{ color: '#5b403c' }}>
                                {new Date(o.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-4 py-3">
                                {o.status === 'Pending' && (
                                  <button onClick={() => handleMarkReady(o.id)}
                                    className="text-xs font-bold px-3 py-1.5 rounded-full text-white hover:opacity-80"
                                    style={{ backgroundColor: '#6f0001' }}>
                                    Hazır
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ MENÜ YÖNETİMİ ═══════════ */}
          {activeTab === 'menu' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black" style={{ color: '#271815' }}>Menü Yönetimi</h2>
                  <p className="text-sm mt-0.5" style={{ color: '#5b403c' }}>Ürünlerinizi ekleyin, düzenleyin veya kaldırın.</p>
                </div>
                <button onClick={openNewItem}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#6f0001' }}>
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Ürün Ekle
                </button>
              </div>

              {/* Ürün ekleme/düzenleme formu */}
              {showMenuForm && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                  <div style={{ backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '540px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 48px)', overflow: 'hidden' }}>

                    {/* Modal Başlık */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 24px 16px', borderBottom: '1px solid #f9dcd7', flexShrink: 0 }}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#271815', margin: 0 }}>
                          {editingItem ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
                        </h3>
                        <p style={{ fontSize: '12px', color: '#5b403c', marginTop: '2px' }}>
                          {editingItem ? 'Ürün bilgilerini güncelleyin.' : 'Menünüze yeni bir ürün ekleyin.'}
                        </p>
                      </div>
                      <button onClick={() => setShowMenuForm(false)}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '12px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#5b403c' }}>close</span>
                      </button>
                    </div>

                    {/* Modal Gövde */}
                    <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>

                      {/* Ürün Adı */}
                      <div>
                        <label style={{ display:'block', fontSize:'13px', fontWeight:600, color:'#271815', marginBottom:'6px' }}>
                          Ürün Adı <span style={{ color:'#6f0001' }}>*</span>
                        </label>
                        <input
                          value={menuForm.name}
                          onChange={e => setMenuForm(f => ({ ...f, name: e.target.value }))}
                          type="text" placeholder="Örn: Truffle Burger"
                          style={{ width:'100%', border:'1.5px solid #e4beb8', borderRadius:'10px', padding:'10px 14px', fontSize:'14px', color:'#271815', outline:'none', boxSizing:'border-box', backgroundColor:'#fffaf9' }}
                          onFocus={e => { e.target.style.borderColor='#6f0001'; e.target.style.backgroundColor='#fff' }}
                          onBlur={e => { e.target.style.borderColor='#e4beb8'; e.target.style.backgroundColor='#fffaf9' }}
                        />
                      </div>

                      {/* Fiyat + Kategori */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                        <div>
                          <label style={{ display:'block', fontSize:'13px', fontWeight:600, color:'#271815', marginBottom:'6px' }}>
                            Fiyat (₺) <span style={{ color:'#6f0001' }}>*</span>
                          </label>
                          <input
                            value={menuForm.price}
                            onChange={e => setMenuForm(f => ({ ...f, price: e.target.value }))}
                            type="number" step="0.01" min="0" placeholder="0.00"
                            style={{ width:'100%', border:'1.5px solid #e4beb8', borderRadius:'10px', padding:'10px 14px', fontSize:'14px', color:'#271815', outline:'none', boxSizing:'border-box', backgroundColor:'#fffaf9' }}
                            onFocus={e => { e.target.style.borderColor='#6f0001'; e.target.style.backgroundColor='#fff' }}
                            onBlur={e => { e.target.style.borderColor='#e4beb8'; e.target.style.backgroundColor='#fffaf9' }}
                          />
                        </div>
                        <div>
                          <label style={{ display:'block', fontSize:'13px', fontWeight:600, color:'#271815', marginBottom:'6px' }}>Kategori</label>
                          <input
                            value={menuForm.category}
                            onChange={e => setMenuForm(f => ({ ...f, category: e.target.value }))}
                            type="text" placeholder="Örn: Burger, Salata..."
                            style={{ width:'100%', border:'1.5px solid #e4beb8', borderRadius:'10px', padding:'10px 14px', fontSize:'14px', color:'#271815', outline:'none', boxSizing:'border-box', backgroundColor:'#fffaf9' }}
                            onFocus={e => { e.target.style.borderColor='#6f0001'; e.target.style.backgroundColor='#fff' }}
                            onBlur={e => { e.target.style.borderColor='#e4beb8'; e.target.style.backgroundColor='#fffaf9' }}
                          />
                        </div>
                      </div>

                      {/* Açıklama */}
                      <div>
                        <label style={{ display:'block', fontSize:'13px', fontWeight:600, color:'#271815', marginBottom:'6px' }}>Açıklama</label>
                        <textarea
                          value={menuForm.description}
                          onChange={e => setMenuForm(f => ({ ...f, description: e.target.value }))}
                          rows={3} placeholder="Ürün hakkında kısa bir açıklama... (isteğe bağlı)"
                          style={{ width:'100%', border:'1.5px solid #e4beb8', borderRadius:'10px', padding:'10px 14px', fontSize:'14px', color:'#271815', outline:'none', boxSizing:'border-box', resize:'none', backgroundColor:'#fffaf9', fontFamily:'inherit' }}
                          onFocus={e => { e.target.style.borderColor='#6f0001'; e.target.style.backgroundColor='#fff' }}
                          onBlur={e => { e.target.style.borderColor='#e4beb8'; e.target.style.backgroundColor='#fffaf9' }}
                        />
                      </div>

                      {/* Görsel URL + Önizleme */}
                      <div>
                        <label style={{ display:'block', fontSize:'13px', fontWeight:600, color:'#271815', marginBottom:'6px' }}>Görsel URL</label>
                        <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
                          <input
                            value={menuForm.imageUrl}
                            onChange={e => setMenuForm(f => ({ ...f, imageUrl: e.target.value }))}
                            type="url" placeholder="https://..."
                            style={{ flex:1, border:'1.5px solid #e4beb8', borderRadius:'10px', padding:'10px 14px', fontSize:'14px', color:'#271815', outline:'none', boxSizing:'border-box', backgroundColor:'#fffaf9' }}
                            onFocus={e => { e.target.style.borderColor='#6f0001'; e.target.style.backgroundColor='#fff' }}
                            onBlur={e => { e.target.style.borderColor='#e4beb8'; e.target.style.backgroundColor='#fffaf9' }}
                          />
                          {menuForm.imageUrl && (
                            <div style={{ width:'52px', height:'52px', borderRadius:'10px', overflow:'hidden', border:'1.5px solid #e4beb8', flexShrink:0 }}>
                              <img src={menuForm.imageUrl} alt="Önizleme" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }} />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Satışta toggle */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderRadius:'10px', border:'1.5px solid #e4beb8', backgroundColor:'#fffaf9' }}>
                        <div>
                          <span style={{ display:'block', fontSize:'13px', fontWeight:600, color:'#271815' }}>Satışta</span>
                          <span style={{ fontSize:'11px', color:'#5b403c' }}>Müşteriler bu ürünü sipariş verebilsin mi?</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMenuForm(f => ({ ...f, isAvailable: !f.isAvailable }))}
                          style={{ position:'relative', width:'44px', height:'24px', borderRadius:'12px', border:'none', cursor:'pointer', backgroundColor: menuForm.isAvailable ? '#6f0001' : '#c6c6c7', transition:'background-color 0.2s', flexShrink:0 }}>
                          <span style={{ position:'absolute', width:'18px', height:'18px', backgroundColor:'#fff', borderRadius:'50%', boxShadow:'0 1px 3px rgba(0,0,0,0.2)', top:'3px', transition:'transform 0.2s', transform: menuForm.isAvailable ? 'translateX(22px)' : 'translateX(3px)' }} />
                        </button>
                      </div>

                      {/* Hata */}
                      {menuError && (
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'12px 14px', borderRadius:'10px', backgroundColor:'#fce8e6', color:'#c5221f', fontSize:'13px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize:'18px' }}>error</span>
                          {menuError}
                        </div>
                      )}
                    </div>

                    {/* Modal Alt Butonlar */}
                    <div style={{ display:'flex', gap:'12px', padding:'16px 24px', borderTop:'1px solid #f9dcd7', flexShrink:0 }}>
                      <button onClick={() => setShowMenuForm(false)}
                        style={{ flex:1, padding:'12px', borderRadius:'50px', border:'1.5px solid #e4beb8', backgroundColor:'#fff', color:'#5b403c', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>
                        İptal
                      </button>
                      <button onClick={handleMenuSave}
                        style={{ flex:1, padding:'12px', borderRadius:'50px', border:'none', backgroundColor:'#6f0001', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>
                        {editingItem ? 'Güncelle' : 'Ürünü Ekle'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {menuLoading ? (
                <div className="py-16 text-center text-sm" style={{ color: '#5b403c' }}>Menü yükleniyor...</div>
              ) : !restaurantId ? (
                <div className="bg-white rounded-xl p-12 text-center" style={{ boxShadow: '0 2px 12px rgba(32,16,0,0.06)' }}>
                  <span className="material-symbols-outlined text-[48px] block mb-3 opacity-20">restaurant_menu</span>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#271815' }}>Restoranınız henüz hazırlanıyor</p>
                  <p className="text-xs" style={{ color: '#5b403c' }}>Admin onayından sonra menünüzü oluşturabilirsiniz.</p>
                </div>
              ) : menuItems.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center" style={{ boxShadow: '0 2px 12px rgba(32,16,0,0.06)' }}>
                  <span className="material-symbols-outlined text-[48px] block mb-3 opacity-20">restaurant_menu</span>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#271815' }}>Menünüzde henüz ürün yok</p>
                  <p className="text-xs mb-4" style={{ color: '#5b403c' }}>İlk ürününüzü ekleyerek başlayın.</p>
                  <button onClick={openNewItem}
                    className="px-6 py-2.5 rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: '#6f0001' }}>
                    İlk Ürünü Ekle
                  </button>
                </div>
              ) : (
                <div>
                  {/* Kategorilere göre grupla */}
                  {categories.length > 0 ? (
                    categories.map(cat => (
                      <div key={cat} className="mb-6">
                        <h3 className="text-sm font-bold uppercase tracking-wider mb-3 px-1" style={{ color: '#5b403c' }}>{cat}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {menuItems.filter(m => m.category === cat).map(item => (
                            <MenuItemCard key={item.id} item={item}
                              onEdit={() => openEditItem(item)}
                              onDelete={() => handleDeleteItem(item.id)} />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : null}
                  {/* Kategorisizler */}
                  {menuItems.filter(m => !m.category).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-bold uppercase tracking-wider mb-3 px-1" style={{ color: '#5b403c' }}>Diğer</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {menuItems.filter(m => !m.category).map(item => (
                          <MenuItemCard key={item.id} item={item}
                            onEdit={() => openEditItem(item)}
                            onDelete={() => handleDeleteItem(item.id)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════ ANALİTİK ═══════════ */}
          {activeTab === 'analytics' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-black" style={{ color: '#271815' }}>Analitik</h2>
                <p className="text-sm mt-0.5" style={{ color: '#5b403c' }}>Restoranınızın performans özeti.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { label: 'Toplam Sipariş', icon: 'receipt_long', value: String(orders.length), color: '#6f0001' },
                  { label: 'Tamamlanan', icon: 'check_circle', value: String(delivered.length), color: '#137333' },
                  { label: 'İptal / Başarısız', icon: 'cancel', value: String(orders.filter(o => o.status === 'Failed').length), color: '#c5221f' },
                  { label: 'Toplam Ciro', icon: 'payments', value: `${totalSales.toFixed(0)} ₺`, color: '#6f0001' },
                  { label: 'Menü Ürünleri', icon: 'restaurant_menu', value: String(menuItems.length), color: '#3949ab' },
                  { label: 'Aktif Ürünler', icon: 'check', value: String(menuItems.filter(m => m.isAvailable).length), color: '#137333' },
                ].map(card => (
                  <div key={card.label} className="bg-white rounded-xl p-6" style={{ boxShadow: '0 2px 12px rgba(32,16,0,0.06)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5b403c' }}>{card.label}</span>
                      <div className="p-2 rounded-full" style={{ backgroundColor: '#fff0ee' }}>
                        <span className="material-symbols-outlined text-[20px]" style={{ color: card.color, fontVariationSettings: "'FILL' 1" }}>{card.icon}</span>
                      </div>
                    </div>
                    <div className="text-3xl font-black" style={{ color: card.color }}>{card.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════ AYARLAR ═══════════ */}
          {activeTab === 'settings' && (
            <SettingsTab
              user={user}
              handleLogout={handleLogout}
              restaurantName={restaurantName}
              restaurantAddress={restaurantAddress}
              restaurantDesc={restaurantDesc}
              restaurantLogoUrl={restaurantLogoUrl}
              restaurantIsOpen={restaurantIsOpen}
            />
          )}

        </div>
      </main>
    </div>
  )
}

// ── Menü Ürün Kartı Bileşeni ─────────────────────────────────────────────────
function MenuItemCard({
  item,
  onEdit,
  onDelete,
}: {
  item: MenuItem
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white rounded-xl overflow-hidden border transition-shadow hover:shadow-md"
      style={{ borderColor: '#f9dcd7', boxShadow: '0 2px 8px rgba(32,16,0,0.04)' }}>
      {item.imageUrl && (
        <div className="h-36 overflow-hidden">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-bold leading-tight" style={{ color: '#271815' }}>{item.name}</p>
          <span className="text-sm font-black flex-shrink-0" style={{ color: '#6f0001' }}>₺{Number(item.price).toFixed(2)}</span>
        </div>
        {item.description && (
          <p className="text-xs mb-2 line-clamp-2" style={{ color: '#5b403c' }}>{item.description}</p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.isAvailable ? '#137333' : '#c6c6c7' }} />
            <span className="text-xs" style={{ color: item.isAvailable ? '#137333' : '#5b403c' }}>
              {item.isAvailable ? 'Satışta' : 'Pasif'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit}
              className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#fff0ee', color: '#6f0001' }}>
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button onClick={onDelete}
              className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#fce8e6', color: '#c5221f' }}>
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Animasyon CSS
const _style = document.createElement('style')
_style.textContent = `@keyframes scaleUp { from{opacity:0;transform:scale(0.95) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }`
document.head.appendChild(_style)

// ── SettingsTab Bileşeni (eski versiyon kaldırıldı) ─────────────────────────
// ── SettingsTab ────────────────────────────────────────────────────────────
const CARD: React.CSSProperties = { backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(32,16,0,0.05)', border: '1px solid #f9dcd7' }
const SECTION_TITLE: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f9dcd7' }
const INPUT: React.CSSProperties = { width: '100%', padding: '9px 14px', border: '1px solid #e4beb8', borderRadius: '8px', fontSize: '14px', color: '#271815', backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const LABEL: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 500, color: '#5b403c', marginBottom: '4px' }
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

// Cloudinary unsigned upload — kendi cloud_name + upload_preset bilgilerini gir
const CLOUDINARY_CLOUD = 'oiyajlxf'
const CLOUDINARY_PRESET = 'götürr'

async function uploadToCloudinary(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', CLOUDINARY_PRESET)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error('Cloudinary yükleme başarısız')
  const data = await res.json() as { secure_url: string }
  return data.secure_url
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      style={{ position: 'relative', width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: on ? '#6f0001' : '#c6c6c7', transition: 'background-color 0.2s', flexShrink: 0, padding: 0 }}>
      <span style={{ position: 'absolute', width: '18px', height: '18px', backgroundColor: '#fff', borderRadius: '50%', top: '3px', transition: 'transform 0.2s', transform: on ? 'translateX(22px)' : 'translateX(3px)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

interface SettingsTabProps {
  user: { fullName: string; email: string; role: string } | null
  handleLogout: () => void
  restaurantName: string
  restaurantAddress: string
  restaurantDesc: string
  restaurantLogoUrl: string
  restaurantIsOpen: boolean
}

function SettingsTab({ user, handleLogout, restaurantName, restaurantAddress, restaurantDesc, restaurantLogoUrl, restaurantIsOpen }: SettingsTabProps) {
  const [isOpen,   setIsOpen]   = React.useState(restaurantIsOpen)
  const [rName,    setRName]    = React.useState(restaurantName)
  const [rAddress, setRAddress] = React.useState(restaurantAddress)
  const [rDesc,    setRDesc]    = React.useState(restaurantDesc)
  const [logoUrl,  setLogoUrl]  = React.useState(restaurantLogoUrl)

  const [minOrder,     setMinOrder]     = React.useState('150')
  const [radius,       setRadius]       = React.useState(5)
  const [prepTime,     setPrepTime]     = React.useState('20-30 Dk')
  const [iban,         setIban]         = React.useState('')
  const [autoPayment,  setAutoPayment]  = React.useState(true)
  const [dayOpen,      setDayOpen]      = React.useState([true,true,true,true,true,true,false])
  const [notifs,       setNotifs]       = React.useState([true,true,true,false])

  const [saving,     setSaving]     = React.useState(false)
  const [saveMsg,    setSaveMsg]    = React.useState<{ok:boolean;text:string}|null>(null)
  const [uploading,  setUploading]  = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Parent'tan gelen veriler yüklenince güncelle
  React.useEffect(() => { setRName(restaurantName)    }, [restaurantName])
  React.useEffect(() => { setRAddress(restaurantAddress) }, [restaurantAddress])
  React.useEffect(() => { setRDesc(restaurantDesc)     }, [restaurantDesc])
  React.useEffect(() => { setLogoUrl(restaurantLogoUrl) }, [restaurantLogoUrl])
  React.useEffect(() => { setIsOpen(restaurantIsOpen)  }, [restaurantIsOpen])

  // Cloudinary logo yükle
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadToCloudinary(file)
      setLogoUrl(url)
    } catch {
      setSaveMsg({ ok: false, text: 'Logo yüklenemedi. Cloudinary ayarlarını kontrol edin.' })
      setTimeout(() => setSaveMsg(null), 3000)
    } finally {
      setUploading(false)
    }
  }

  // Kaydet — PATCH /api/restaurants/mine
  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      await api.patch('/restaurants/mine', {
        name:        rName        || undefined,
        address:     rAddress     || undefined,
        description: rDesc        || undefined,
        logoUrl:     logoUrl      || undefined,
        isOpen,
      })
      setSaveMsg({ ok: true, text: 'Değişiklikler kaydedildi!' })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setSaveMsg({ ok: false, text: e?.response?.data?.message ?? 'Kayıt başarısız.' })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  const notifItems = [
    { label: 'Yeni Sipariş Sesi',      sub: 'Yeni sipariş geldiğinde sesli uyarı çal' },
    { label: 'Günlük Özet E-postası',  sub: 'Günün sonunda satış özeti e-postası al' },
    { label: 'Kurye Yaklaşma Uyarısı', sub: 'Kurye restorana yaklaştığında uyar' },
    { label: 'SMS Bildirimleri',       sub: 'Acil durumlarda SMS al (Yakında)', disabled: true },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'28px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h2 style={{ fontSize:'24px', fontWeight:900, color:'#271815', margin:0 }}>Ayarlar</h2>
          <p style={{ fontSize:'13px', color:'#5b403c', marginTop:'4px' }}>Hesap ve restoran bilgilerinizi yönetin.</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'10px 20px', borderRadius:'50px', border:'none', backgroundColor: saving ? '#a0a0a0' : '#6f0001', color:'#fff', fontSize:'14px', fontWeight:700, cursor: saving ? 'wait' : 'pointer', transition:'background-color 0.2s', opacity: saving ? 0.8 : 1 }}>
            {saving
              ? <><span style={{ width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} /> Kaydediliyor...</>
              : <><span className="material-symbols-outlined" style={{ fontSize:'18px' }}>save</span>Değişiklikleri Kaydet</>
            }
          </button>
          {saveMsg && (
            <span style={{ fontSize:'12px', fontWeight:600, color: saveMsg.ok ? '#137333' : '#c5221f', display:'flex', alignItems:'center', gap:'4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize:'15px' }}>{saveMsg.ok ? 'check_circle' : 'error'}</span>
              {saveMsg.text}
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth:'896px', display:'flex', flexDirection:'column', gap:'24px', paddingBottom:'40px' }}>

        {/* 1 — Restoran Profili */}
        <section style={CARD}>
          <div style={SECTION_TITLE}>
            <span className="material-symbols-outlined" style={{ color:'#6f0001', fontSize:'24px' }}>storefront</span>
            <h3 style={{ fontSize:'18px', fontWeight:700, color:'#271815', margin:0 }}>Restoran Profili</h3>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'24px', alignItems:'start', marginBottom:'20px' }}>
            {/* Logo */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ width:'96px', height:'96px', borderRadius:'50%', overflow:'hidden', border:'3px solid #fff', boxShadow:'0 4px 12px rgba(32,16,0,0.1)', backgroundColor:'#fff0ee', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative' }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize:'40px', color:'#6f0001' }}>restaurant</span>
                )}
                {uploading && (
                  <div style={{ position:'absolute', inset:0, backgroundColor:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%' }}>
                    <span style={{ width:'24px', height:'24px', border:'3px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} />
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoChange} />
              <span style={{ fontSize:'11px', color:'#5b403c', cursor:'pointer' }} onClick={() => fileInputRef.current?.click()}>
                {uploading ? 'Yükleniyor...' : 'Logo Değiştir'}
              </span>
            </div>
            {/* Ad + Adres */}
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={LABEL}>Restoran Adı</label>
                <input value={rName} onChange={e => setRName(e.target.value)} style={INPUT}
                  onFocus={e => e.target.style.borderColor='#6f0001'} onBlur={e => e.target.style.borderColor='#e4beb8'} />
              </div>
              <div>
                <label style={LABEL}>Adres</label>
                <input value={rAddress} onChange={e => setRAddress(e.target.value)} style={INPUT}
                  onFocus={e => e.target.style.borderColor='#6f0001'} onBlur={e => e.target.style.borderColor='#e4beb8'} />
              </div>
            </div>
          </div>
          <div style={{ marginBottom:'16px' }}>
            <label style={LABEL}>Açıklama</label>
            <textarea value={rDesc} onChange={e => setRDesc(e.target.value)} rows={3}
              style={{ ...INPUT, resize:'none' }}
              onFocus={e => e.target.style.borderColor='#6f0001'} onBlur={e => e.target.style.borderColor='#e4beb8'} />
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:'10px', border:'1.5px solid #e4beb8', backgroundColor:'#fffaf9' }}>
            <div>
              <span style={{ display:'block', fontSize:'14px', fontWeight:600, color:'#271815' }}>
                {isOpen ? '🟢 Restoran Açık' : '🔴 Restoran Kapalı'}
              </span>
              <span style={{ fontSize:'12px', color:'#5b403c' }}>
                {isOpen ? 'Müşteriler sipariş verebilir.' : 'Yeni sipariş alınmıyor.'}
              </span>
            </div>
            <Toggle on={isOpen} onChange={() => setIsOpen(v => !v)} />
          </div>
        </section>

        {/* 2 — Çalışma Saatleri */}
        <section style={CARD}>
          <div style={SECTION_TITLE}>
            <span className="material-symbols-outlined" style={{ color:'#6f0001', fontSize:'24px' }}>schedule</span>
            <h3 style={{ fontSize:'18px', fontWeight:700, color:'#271815', margin:0 }}>Çalışma Saatleri</h3>
          </div>
          <div>
            {DAYS.map((day, i) => (
              <div key={day} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 0', borderBottom: i < DAYS.length-1 ? '1px solid #fff0ee' : 'none', opacity: dayOpen[i] ? 1 : 0.45 }}>
                <span style={{ width:'88px', fontSize:'14px', fontWeight:600, color:'#271815', flexShrink:0 }}>{day}</span>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px', justifyContent:'center' }}>
                  {dayOpen[i] ? (
                    <>
                      <input type="time" defaultValue="09:00" style={{ border:'1px solid #e4beb8', borderRadius:'8px', padding:'6px 10px', fontSize:'13px', color:'#271815', outline:'none' }} />
                      <span style={{ color:'#5b403c', fontSize:'13px' }}>—</span>
                      <input type="time" defaultValue="23:00" style={{ border:'1px solid #e4beb8', borderRadius:'8px', padding:'6px 10px', fontSize:'13px', color:'#271815', outline:'none' }} />
                    </>
                  ) : (
                    <span style={{ fontSize:'13px', color:'#5b403c', fontStyle:'italic' }}>Kapalı</span>
                  )}
                </div>
                <Toggle on={dayOpen[i]} onChange={() => setDayOpen(prev => prev.map((v,j) => j===i ? !v : v))} />
              </div>
            ))}
          </div>
        </section>

        {/* 3 — Teslimat + Finans */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'24px' }}>
          <section style={CARD}>
            <div style={SECTION_TITLE}>
              <span className="material-symbols-outlined" style={{ color:'#6f0001', fontSize:'24px' }}>local_shipping</span>
              <h3 style={{ fontSize:'18px', fontWeight:700, color:'#271815', margin:0 }}>Teslimat</h3>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={LABEL}>Minimum Sipariş Tutarı (₺)</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', fontSize:'14px', color:'#5b403c', fontWeight:600, pointerEvents:'none' }}>₺</span>
                  <input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)}
                    style={{ ...INPUT, paddingLeft:'28px' }}
                    onFocus={e => e.target.style.borderColor='#6f0001'} onBlur={e => e.target.style.borderColor='#e4beb8'} />
                </div>
              </div>
              <div>
                <label style={LABEL}>Teslimat Yarıçapı: <strong style={{ color:'#6f0001' }}>{radius} km</strong></label>
                <input type="range" min={1} max={15} value={radius} onChange={e => setRadius(Number(e.target.value))}
                  style={{ width:'100%', accentColor:'#6f0001', cursor:'pointer' }} />
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#5b403c', marginTop:'2px' }}>
                  <span>1 km</span><span>15 km</span>
                </div>
              </div>
              <div>
                <label style={LABEL}>Ort. Hazırlama Süresi</label>
                <select value={prepTime} onChange={e => setPrepTime(e.target.value)} style={INPUT}>
                  {['10-20 Dk','20-30 Dk','30-45 Dk','45+ Dk'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section style={CARD}>
            <div style={SECTION_TITLE}>
              <span className="material-symbols-outlined" style={{ color:'#6f0001', fontSize:'24px' }}>account_balance</span>
              <h3 style={{ fontSize:'18px', fontWeight:700, color:'#271815', margin:0 }}>Finans</h3>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={LABEL}>Hesap Sahibi</label>
                <input readOnly value={user?.fullName ?? ''} style={{ ...INPUT, backgroundColor:'#fff8f6', color:'#5b403c' }} />
              </div>
              <div>
                <label style={LABEL}>IBAN Numarası</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', fontSize:'13px', color:'#5b403c', fontWeight:700, pointerEvents:'none' }}>TR</span>
                  <input value={iban} onChange={e => setIban(e.target.value)}
                    style={{ ...INPUT, paddingLeft:'36px', fontFamily:'monospace', letterSpacing:'0.06em', fontSize:'13px' }}
                    onFocus={e => e.target.style.borderColor='#6f0001'} onBlur={e => e.target.style.borderColor='#e4beb8'} />
                </div>
                <p style={{ fontSize:'11px', color:'#5b403c', marginTop:'4px' }}>Sadece TR IBAN kabul edilmektedir.</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:'12px', borderTop:'1px solid #fff0ee' }}>
                <span style={{ fontSize:'14px', fontWeight:600, color:'#271815' }}>Otomatik Ödeme Al</span>
                <Toggle on={autoPayment} onChange={() => setAutoPayment(v => !v)} />
              </div>
            </div>
          </section>
        </div>

        {/* 4 — Bildirimler */}
        <section style={CARD}>
          <div style={SECTION_TITLE}>
            <span className="material-symbols-outlined" style={{ color:'#6f0001', fontSize:'24px' }}>notifications_active</span>
            <h3 style={{ fontSize:'18px', fontWeight:700, color:'#271815', margin:0 }}>Bildirim Tercihleri</h3>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'12px' }}>
            {notifItems.map((item, i) => (
              <label key={i} style={{ display:'flex', alignItems:'flex-start', gap:'12px', padding:'14px', borderRadius:'10px', border:'1px solid #e4beb8', cursor: item.disabled ? 'not-allowed' : 'pointer', opacity: item.disabled ? 0.55 : 1, backgroundColor:'#fffaf9' }}>
                <input type="checkbox" checked={notifs[i]} disabled={item.disabled}
                  onChange={() => !item.disabled && setNotifs(prev => prev.map((v,j) => j===i ? !v : v))}
                  style={{ width:'18px', height:'18px', accentColor:'#6f0001', marginTop:'2px', flexShrink:0 }} />
                <div>
                  <span style={{ display:'block', fontSize:'14px', fontWeight:600, color:'#271815' }}>{item.label}</span>
                  <span style={{ fontSize:'12px', color:'#5b403c' }}>{item.sub}</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* 5 — Hesap */}
        <section style={CARD}>
          <div style={SECTION_TITLE}>
            <span className="material-symbols-outlined" style={{ color:'#6f0001', fontSize:'24px' }}>account_circle</span>
            <h3 style={{ fontSize:'18px', fontWeight:700, color:'#271815', margin:0 }}>Hesap</h3>
          </div>
          {[{ label:'Ad Soyad', value: user?.fullName }, { label:'E-posta', value: user?.email }].map(row => (
            <div key={row.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #fff0ee' }}>
              <span style={{ fontSize:'14px', color:'#5b403c' }}>{row.label}</span>
              <span style={{ fontSize:'14px', fontWeight:600, color:'#271815' }}>{row.value}</span>
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #fff0ee' }}>
            <span style={{ fontSize:'14px', color:'#5b403c' }}>Rol</span>
            <span style={{ fontSize:'12px', fontWeight:700, padding:'4px 12px', borderRadius:'50px', backgroundColor:'#6f0001', color:'#fff' }}>🍽️ Restoran</span>
          </div>
          <div style={{ paddingTop:'16px' }}>
            <button onClick={handleLogout}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'11px 24px', borderRadius:'50px', border:'2px solid #c5221f', backgroundColor:'#fff', color:'#c5221f', fontSize:'14px', fontWeight:700, cursor:'pointer' }}>
              <span className="material-symbols-outlined" style={{ fontSize:'18px' }}>logout</span>
              Çıkış Yap
            </button>
          </div>
        </section>

      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
