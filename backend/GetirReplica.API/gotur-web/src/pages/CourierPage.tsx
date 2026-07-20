import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../services/api'
import { authService } from '../services/authService'
import ThemeToggle from '../components/ThemeToggle'
import type { Order } from '../types'

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const courierIcon = L.divIcon({
  html: `<div style="
    background:var(--accent,#9a0002);width:44px;height:44px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:3px solid white;box-shadow:0 0 0 4px rgba(154,0,2,0.25);
    animation:pulse-ring 2s infinite;">
    <span style="font-size:22px;line-height:1;">🛵</span>
  </div>`,
  className: '', iconSize: [44, 44], iconAnchor: [22, 22],
})

const deliveryIcon = L.divIcon({
  html: `<div style="
    background:#fff;width:36px;height:36px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:2px solid var(--accent,#9a0002);box-shadow:0 2px 8px rgba(0,0,0,0.2);">
    <span style="font-size:18px;line-height:1;">🏠</span>
  </div>`,
  className: '', iconSize: [36, 36], iconAnchor: [18, 36],
})

// ── Map auto-center ───────────────────────────────────────────────────────────
function MapFly({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => { map.setView(center, map.getZoom(), { animate: true }) }, [center, map])
  return null
}

// ── Style shortcuts ───────────────────────────────────────────────────────────
const pStyle = { color: 'var(--text-primary)' }
const sStyle = { color: 'var(--text-secondary)' }
const aStyle = { color: 'var(--accent)' }
const cardStyle = { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }

const STATUS_LABELS: Record<string, string> = {
  Pending:   'Kurye Bekleniyor',
  Assigned:  'Restorana Git',
  Picked:    'Teslimat Yolunda',
  Delivered: 'Teslim Edildi',
}

const SIM_START = { lat: 40.9906, lng: 29.0287 }

export default function CourierPage() {
  const navigate  = useNavigate()

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeOrder,    setActiveOrder]    = useState<Order | null>(null)
  const [selectedOrder,  setSelectedOrder]  = useState<Order | null>(null) // modal
  const [tracking,       setTracking]       = useState(false)
  const [simMode,        setSimMode]        = useState(false)
  const [statusMsg,      setStatusMsg]      = useState('')
  const [online,         setOnline]         = useState(true)
  const [notification,   setNotification]   = useState<string | null>('Kadıköy bölgesinde +₺20 ek ücret aktif!')
  const [todayEarnings,  setTodayEarnings]  = useState(450)
  const [courierPos,     setCourierPos]     = useState<[number,number]>([SIM_START.lat, SIM_START.lng])

  const watchRef  = useRef<number | null>(null)
  const simRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const simPosRef = useRef({ ...SIM_START })

  // ── API calls ─────────────────────────────────────────────────────────────
  const fetchActiveOrder = async () => {
    try {
      const res = await api.get<Order>('/couriers/my-order')
      setActiveOrder(res.data ?? null)
    } catch (err: unknown) {
      const s = (err as { response?: { status?: number } })?.response?.status
      if (s === 204 || s === 404) setActiveOrder(null)
      else console.error(err)
    }
  }

  useEffect(() => { fetchActiveOrder() }, [])

  // ── GPS / Simulator ───────────────────────────────────────────────────────
  const sendLocation = async (lat: number, lng: number) => {
    try {
      await api.put('/couriers/location', { latitude: lat, longitude: lng })
      setCourierPos([lat, lng])
      setStatusMsg(`Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}`)
    } catch { setStatusMsg('Konum gönderilemedi.') }
  }

  const startGPS = () => {
    if (!navigator.geolocation) { setStatusMsg('GPS desteklenmiyor.'); return }
    setTracking(true); setSimMode(false); setStatusMsg('Konum gönderiliyor...')
    watchRef.current = navigator.geolocation.watchPosition(
      pos => sendLocation(pos.coords.latitude, pos.coords.longitude),
      err => setStatusMsg(`GPS hatası: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 0 }
    )
  }

  const startSim = () => {
    simPosRef.current = { ...SIM_START }
    setTracking(true); setSimMode(true); setStatusMsg('Simülatör aktif...')
    simRef.current = setInterval(() => {
      simPosRef.current = {
        lat: simPosRef.current.lat + (Math.random() - 0.5) * 0.001,
        lng: simPosRef.current.lng + (Math.random() - 0.5) * 0.001,
      }
      sendLocation(simPosRef.current.lat, simPosRef.current.lng)
    }, 3000)
  }

  const stopTracking = () => {
    if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null }
    if (simRef.current !== null) { clearInterval(simRef.current); simRef.current = null }
    setTracking(false); setSimMode(false); setStatusMsg('Takip durduruldu.')
  }

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
    if (simRef.current !== null) clearInterval(simRef.current)
  }, [])

  // ── Sipariş durumu güncelle ───────────────────────────────────────────────
  const updateStatus = async (newStatus: string) => {
    if (!activeOrder) return
    try {
      await api.patch('/couriers/my-order/status', { status: newStatus })
      await fetchActiveOrder()
      setSelectedOrder(null)
      if (newStatus === 'Delivered') {
        setTodayEarnings(e => e + Math.round((activeOrder.items.reduce((s,i)=>s+i.price*i.quantity,0)) * 0.15))
        setNotification('🎉 Teslimat tamamlandı! Harika iş!')
      }
    } catch (e) { console.error(e) }
  }

  const handleLogout = () => { authService.logout(); navigate('/login') }

  const delivLoc = activeOrder
    ? [activeOrder.deliveryLocation.latitude, activeOrder.deliveryLocation.longitude] as [number, number]
    : null

  return (
    <div className="h-screen flex flex-col font-sans antialiased overflow-hidden transition-colors"
      style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}>

      {/* pulse animation */}
      <style>{`
        @keyframes pulse-ring {
          0%,100%{box-shadow:0 0 0 4px rgba(154,0,2,0.3)}
          50%{box-shadow:0 0 0 10px rgba(154,0,2,0.05)}
        }
      `}</style>

      {/* ── HEADER ── */}
      <header className="border-b flex-shrink-0 z-50 transition-colors" style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-12 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black italic" style={aStyle}>Götür</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: 'var(--accent)' }}>Kurye</span>
          </div>
          <nav className="hidden md:flex gap-5">
            {['Dashboard', 'Kazançlar', 'Geçmiş'].map((item, i) => (
              <a key={item} href="#" className="text-sm font-semibold pb-1 transition-opacity hover:opacity-70"
                style={{ ...( i === 0 ? { ...aStyle, borderBottom: '2px solid var(--accent)' } : sStyle ) }}>
                {item}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {/* Online/Offline toggle */}
            <button onClick={() => setOnline(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all"
              style={{ borderColor: 'var(--border)', backgroundColor: online ? '#d1fae5' : 'var(--bg-muted)', color: online ? '#065f46' : 'var(--text-secondary)' }}>
              <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-gray-400'}`} style={online ? { animation: 'pulse-ring 2s infinite' } : {}} />
              {online ? 'Çevrimiçi' : 'Çevrimdışı'}
            </button>
            {/* Günlük kazanç */}
            <div className="hidden md:flex flex-col items-end pr-3 border-r" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={sStyle}>Bugünkü Kazanç</span>
              <span className="text-lg font-black" style={aStyle}>₺{todayEarnings.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            </div>
            <ThemeToggle />
            <button onClick={handleLogout} className="text-sm font-semibold px-3 py-1.5 rounded-full border hover:opacity-70 transition-opacity"
              style={{ ...sStyle, borderColor: 'var(--border)' }}>Çıkış</button>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* ── Sol Sidebar (desktop) ── */}
        <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 border-r overflow-y-auto z-40 transition-colors"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex flex-col h-full pt-6 pb-6">
            <div className="px-5 mb-5">
              <h2 className="text-base font-black" style={aStyle}>Aktif Siparişler</h2>
              <p className="text-xs mt-0.5" style={sStyle}>{activeOrder ? '1 aktif teslimat' : 'Bekleyen sipariş yok'}</p>
            </div>

            {/* Sipariş listesi */}
            <nav className="flex-1 overflow-y-auto px-2 space-y-1">
              {activeOrder ? (
                <button onClick={() => setSelectedOrder(activeOrder)}
                  className="w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-all hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold block">#{activeOrder.id.slice(0, 8).toUpperCase()}</span>
                    <span className="text-xs opacity-80">{STATUS_LABELS[activeOrder.status] ?? activeOrder.status}</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </button>
              ) : (
                <div className="px-4 py-8 text-center">
                  <span className="material-symbols-outlined text-[40px] mb-2" style={sStyle}>inbox</span>
                  <p className="text-xs" style={sStyle}>Sipariş yok</p>
                  <button onClick={fetchActiveOrder} className="mt-3 text-xs font-semibold hover:opacity-70 transition-opacity" style={aStyle}>Yenile</button>
                </div>
              )}
            </nav>

            {/* Konum paylaşımı */}
            <div className="mx-3 mt-4 p-3 rounded-xl border" style={cardStyle}>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={sStyle}>Konum Paylaşımı</p>
              <div className="flex gap-2">
                {tracking ? (
                  <button onClick={stopTracking} className="flex-1 py-2 rounded-lg text-xs font-bold border transition-opacity hover:opacity-70"
                    style={{ borderColor: '#fca5a5', backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                    <span className="material-symbols-outlined text-[14px] align-middle mr-0.5">stop</span>Durdur
                  </button>
                ) : (
                  <>
                    <button onClick={startGPS} className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80" style={{ backgroundColor: 'var(--accent)' }}>
                      <span className="material-symbols-outlined text-[14px] align-middle mr-0.5">gps_fixed</span>GPS
                    </button>
                    <button onClick={startSim} className="flex-1 py-2 rounded-lg text-xs font-bold border transition-opacity hover:opacity-70" style={{ ...aStyle, borderColor: 'var(--accent)' }}>
                      <span className="material-symbols-outlined text-[14px] align-middle mr-0.5">sports_esports</span>Sim
                    </button>
                  </>
                )}
              </div>
              {tracking && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {simMode ? 'Simülatör aktif' : 'GPS takipte'}
                  {statusMsg && <span className="ml-1 opacity-60 truncate">{statusMsg}</span>}
                </div>
              )}
            </div>

            {/* Alt linkler */}
            <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              {[{ icon: 'help', label: 'Destek' }, { icon: 'settings', label: 'Ayarlar' }].map(l => (
                <button key={l.icon} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:opacity-70 transition-opacity text-left"
                  style={sStyle}>
                  <span className="material-symbols-outlined text-[18px]">{l.icon}</span>
                  <span className="text-sm font-semibold">{l.label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Harita ── */}
        <div className="flex-1 relative overflow-hidden">
          <MapContainer center={courierPos} zoom={14} style={{ width: '100%', height: '100%' }} zoomControl={false}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapFly center={courierPos} />
            {/* Kurye konumu */}
            <Marker position={courierPos} icon={courierIcon}>
              <Popup>🛵 Senin konumun</Popup>
            </Marker>
            {/* Teslimat noktası */}
            {delivLoc && (
              <Marker position={delivLoc} icon={deliveryIcon}>
                <Popup>
                  <div className="text-sm font-semibold">📦 Teslimat noktası</div>
                  <div className="text-xs mt-1">{activeOrder?.deliveryAddress}</div>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Bildirim */}
          {notification && (
            <div className="absolute top-4 right-4 z-[500] max-w-sm w-full">
              <div className="flex items-start gap-3 p-4 rounded-xl shadow-lg border-l-4" style={{ backgroundColor: 'var(--bg-card)', borderLeftColor: 'var(--accent)', borderTopColor: 'var(--border)', borderRightColor: 'var(--border)', borderBottomColor: 'var(--border)', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: 'var(--accent)' }}>
                  <span className="material-symbols-outlined text-[16px]">campaign</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={pStyle}>Bölge Bildirimi</p>
                  <p className="text-xs mt-0.5" style={sStyle}>{notification}</p>
                </div>
                <button onClick={() => setNotification(null)} className="hover:opacity-70 transition-opacity" style={sStyle}>
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          )}

          {/* Aktif sipariş kartı — haritanın üstünde floating */}
          {activeOrder && (
            <div className="absolute bottom-6 right-4 left-4 md:left-auto md:w-96 z-[500]">
              <div className="rounded-2xl shadow-2xl border p-5 backdrop-blur-sm"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                {/* Başlık */}
                <div className="flex justify-between items-start pb-4 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold text-white" style={{ backgroundColor: 'var(--accent)' }}>Aktif Sipariş</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <h3 className="text-base font-black" style={pStyle}>
                      #{activeOrder.id.slice(0, 8).toUpperCase()}
                    </h3>
                    <p className="text-xs flex items-center gap-1 mt-0.5" style={sStyle}>
                      <span className="material-symbols-outlined text-[13px]">person</span>
                      Müşteri teslimatı
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black" style={aStyle}>
                      ₺{activeOrder.items.reduce((s,i)=>s+i.price*i.quantity,0).toLocaleString('tr-TR', {minimumFractionDigits:2})}
                    </p>
                    <p className="text-[11px]" style={sStyle}>Kapıda Ödeme</p>
                  </div>
                </div>

                {/* Rota */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--accent)' }}>
                      <span className="material-symbols-outlined text-[16px]">storefront</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={pStyle}>Restoran</p>
                      <p className="text-xs" style={sStyle}>Sipariş alınacak nokta</p>
                    </div>
                  </div>
                  <div className="ml-4 w-px h-4" style={{ backgroundColor: 'var(--border)' }} />
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--accent)' }}>
                      <span className="material-symbols-outlined text-[16px]">home_pin</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={pStyle}>Teslimat Noktası</p>
                      <p className="text-xs" style={sStyle}>{activeOrder.deliveryAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Ürünler */}
                <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'var(--bg-muted)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={sStyle}>Sipariş İçeriği</p>
                  <div className="space-y-1">
                    {activeOrder.items.map((item, i) => {
                      const it = item as unknown as { name?: string; quantity?: number; price?: number; Name?: string; Quantity?: number; Price?: number }
                      const name  = it.name  ?? it.Name  ?? 'Ürün'
                      const qty   = it.quantity ?? it.Quantity ?? 1
                      const price = it.price ?? it.Price ?? 0
                      return (
                        <div key={i} className="flex justify-between text-xs">
                          <span style={sStyle}>{name} <span className="font-semibold" style={pStyle}>×{qty}</span></span>
                          <span className="font-bold" style={pStyle}>₺{(price * qty).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Aksiyon butonları */}
                <div className="flex flex-col gap-2">
                  {activeOrder.status === 'Assigned' && (
                    <>
                      <button onClick={() => updateStatus('Picked')}
                        className="w-full py-3.5 rounded-full text-white font-black text-sm shadow-md hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        style={{ backgroundColor: 'var(--accent)' }}>
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        Siparişi Teslim Aldım
                      </button>
                      <button onClick={() => setSelectedOrder(activeOrder)}
                        className="w-full py-3 rounded-full text-sm font-semibold border hover:opacity-70 transition-opacity"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                        Restorana Ulaştım
                      </button>
                    </>
                  )}
                  {activeOrder.status === 'Picked' && (
                    <button onClick={() => updateStatus('Delivered')}
                      className="w-full py-3.5 rounded-full text-white font-black text-sm shadow-md hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#059669' }}>
                      <span className="material-symbols-outlined text-[18px]">celebration</span>
                      Müşteriye Teslim Ettim
                    </button>
                  )}
                  <button onClick={() => setSelectedOrder(activeOrder)}
                    className="w-full py-2.5 rounded-full text-xs font-semibold border hover:opacity-70 transition-opacity flex items-center justify-center gap-1"
                    style={{ borderColor: 'var(--border)', ...sStyle }}>
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    Sipariş Detayı & Durum Güncelle
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sipariş yok mesajı */}
          {!activeOrder && (
            <div className="absolute bottom-6 right-4 left-4 md:left-auto md:w-80 z-[500]">
              <div className="rounded-2xl p-6 text-center border backdrop-blur-sm"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
                <span className="material-symbols-outlined text-[48px] mb-3" style={sStyle}>inbox</span>
                <h3 className="font-black text-base mb-1" style={pStyle}>Aktif sipariş yok</h3>
                <p className="text-sm mb-4" style={sStyle}>Yeni siparişler otomatik atanacak</p>
                <button onClick={fetchActiveOrder} className="px-6 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--accent)' }}>
                  Yenile
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Mobil alt nav ── */}
      <nav className="fixed bottom-0 left-0 w-full h-16 flex justify-around items-center border-t lg:hidden z-50 rounded-t-xl shadow-lg transition-colors"
        style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
        {[
          { icon: 'home', label: 'Ana Sayfa', active: true },
          { icon: 'map', label: 'Harita', active: false },
          { icon: 'local_shipping', label: 'Siparişler', active: false, dot: !!activeOrder },
          { icon: 'person', label: 'Profil', active: false },
        ].map(item => (
          <button key={item.icon} className="flex flex-col items-center justify-center relative p-2 hover:opacity-70 transition-opacity">
            <div className="relative">
              <span className="material-symbols-outlined text-[22px]"
                style={{ ...(item.active ? aStyle : sStyle), fontVariationSettings: item.active ? "'FILL' 1" : "'FILL' 0" }}>
                {item.icon}
              </span>
              {item.dot && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />}
            </div>
            <span className="text-[10px] font-medium mt-0.5" style={item.active ? aStyle : sStyle}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Sipariş Detay Modal ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[600] flex items-end md:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setSelectedOrder(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl border animate-[modalIn_0.2s_ease-out]"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-black" style={pStyle}>
                Sipariş #{selectedOrder.id.slice(0, 8).toUpperCase()}
              </h3>
              <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity" style={{ backgroundColor: 'var(--bg-muted)', ...sStyle }}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Sipariş bilgileri */}
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-muted)' }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={sStyle}>Teslimat Adresi</p>
              <p className="text-sm font-semibold" style={pStyle}>{selectedOrder.deliveryAddress}</p>
            </div>

            {/* Ürünler */}
            <div className="space-y-2 mb-5">
              {selectedOrder.items.map((item, i) => {
                const it = item as unknown as { name?: string; quantity?: number; price?: number; Name?: string; Quantity?: number; Price?: number }
                const name  = it.name  ?? it.Name  ?? 'Ürün'
                const qty   = it.quantity ?? it.Quantity ?? 1
                const price = it.price ?? it.Price ?? 0
                return (
                  <div key={i} className="flex justify-between text-sm py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                    <span style={sStyle}>{name} <span className="font-semibold" style={pStyle}>×{qty}</span></span>
                    <span className="font-bold" style={pStyle}>₺{(price * qty).toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                  </div>
                )
              })}
              <div className="flex justify-between text-base font-black pt-1">
                <span style={pStyle}>Toplam</span>
                <span style={aStyle}>₺{selectedOrder.items.reduce((s,i)=>s+i.price*i.quantity,0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</span>
              </div>
            </div>

            {/* Durum butonları */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide mb-3" style={sStyle}>Durumu Güncelle</p>
              {[
                { status: 'Picked',    label: '✅ Siparişi Teslim Aldım', show: selectedOrder.status === 'Assigned', bg: 'var(--accent)' },
                { status: 'Delivered', label: '🎉 Müşteriye Teslim Ettim', show: selectedOrder.status === 'Picked',  bg: '#059669' },
              ].map(btn => btn.show && (
                <button key={btn.status} onClick={() => updateStatus(btn.status)}
                  className="w-full py-3.5 rounded-full text-white font-black text-sm shadow-md hover:opacity-90 transition-all active:scale-[0.98]"
                  style={{ backgroundColor: btn.bg }}>
                  {btn.label}
                </button>
              ))}
              {selectedOrder.status === 'Delivered' && (
                <div className="py-4 text-center">
                  <span className="text-3xl">🎉</span>
                  <p className="text-sm font-bold mt-2 text-emerald-600">Bu sipariş teslim edildi!</p>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 pt-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedOrder.status === 'Delivered' ? '#059669' : 'var(--accent)' }} />
                <span className="text-xs" style={sStyle}>Mevcut durum: <strong style={pStyle}>{STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalIn {
          from{opacity:0;transform:translateY(20px) scale(0.97)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }
      `}</style>
    </div>
  )
}
