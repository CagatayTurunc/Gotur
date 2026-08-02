import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MapView from '../components/MapView'
import ThemeToggle from '../components/ThemeToggle'
import { useSignalR } from '../hooks/useSignalR'
import { orderService } from '../services/orderService'
import { authService } from '../services/authService'
import api from '../services/api'
import type { Order } from '../types'

// ── Durum tanımları ──────────────────────────────────────────────────────────
const STEPS = [
  { key: 'Pending',   label: 'Sipariş Alındı',    icon: 'receipt_long' },
  { key: 'Assigned',  label: 'Hazırlanıyor',       icon: 'restaurant' },
  { key: 'Picked',    label: 'Yolda',              icon: 'two_wheeler' },
  { key: 'Delivered', label: 'Teslim Edildi',      icon: 'home' },
]

const STATUS_ORDER = ['Pending', 'Assigned', 'Picked', 'Delivered']

const ETA: Record<string, string> = {
  Pending:   '20-25 dk',
  Assigned:  '15-20 dk',
  Picked:    '8-12 dk',
  Delivered: '—',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const pStyle  = { color: 'var(--text-primary)' }
const sStyle  = { color: 'var(--text-secondary)' }
const aStyle  = { color: 'var(--accent)' }

function stepIndex(status: string) {
  return STATUS_ORDER.indexOf(status)
}

export default function TrackingPage() {
  const { orderId }  = useParams<{ orderId: string }>()
  const navigate     = useNavigate()
  const user         = authService.getUser()
  const [order, setOrder] = useState<Order | null>(null)
  const [courierName, setCourierName] = useState<string | null>(null)
  const [initialLocation, setInitialLocation] = useState<{ lat: number; lng: number } | null>(null)

  const { courierLocation, orderStatus, isConnected, locationTimeout } = useSignalR({
    orderId: orderId ?? '',
    enabled: !!orderId,
  })

  useEffect(() => {
    if (!orderId) return
    orderService.getOrder(orderId).then(o => {
      setOrder(o)
      // Kurye atandıysa adını çek
      if (o.courierId) {
        api.get<{ fullName: string }>(`/couriers/${o.courierId}/info`)
          .then(r => setCourierName(r.data.fullName))
          .catch(() => {})
      }
    }).catch(console.error)
    orderService.getTracking(orderId)
      .then(loc => { if (loc) setInitialLocation({ lat: loc.latitude, lng: loc.longitude }) })
      .catch(console.error)
  }, [orderId])

  const currentStatus  = orderStatus ?? order?.status ?? 'Pending'
  const currentStep    = stepIndex(currentStatus)
  const displayLocation = courierLocation ?? initialLocation
  const isDelivered    = currentStatus === 'Delivered'
  const isFailed       = currentStatus === 'Failed'
  const total          = order?.items.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0

  const handleLogout = () => { authService.logout(); navigate('/login') }

  return (
    <div className="h-screen flex flex-col font-sans antialiased transition-colors overflow-hidden"
      style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}>

      {/* ── HEADER ── */}
      <header className="border-b z-50 flex-shrink-0 transition-colors"
        style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-12 h-14 flex items-center justify-between gap-4">
          <button onClick={() => navigate('/')} className="text-xl font-black italic tracking-tight hover:opacity-70 transition-opacity" style={aStyle}>
            Götür
          </button>
          <div className="flex items-center gap-2 md:gap-4">
            {/* Canlı bağlantı göstergesi */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: isConnected ? '#d1fae5' : 'var(--bg-muted)', color: isConnected ? '#065f46' : 'var(--text-secondary)' }}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              {isConnected ? 'Canlı' : 'Bekleniyor'}
            </div>
            <ThemeToggle />
            {user && (
              <button onClick={handleLogout} className="hidden md:block text-sm font-semibold px-3 py-1.5 rounded-full border hover:opacity-70 transition-opacity"
                style={{ ...sStyle, borderColor: 'var(--border)' }}>Çıkış</button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN: harita sol, panel sağ ── */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* ── HARİTA ── */}
        <div className="w-full md:w-3/5 h-1/2 md:h-full relative flex-shrink-0"
          style={{ borderRight: `1px solid var(--border)` }}>

          {/* Gerçek Leaflet haritası */}
          <div className="w-full h-full">
            <MapView
              courierLocation={displayLocation}
              deliveryLocation={order ? {
                lat: order.deliveryLocation.latitude,
                lng: order.deliveryLocation.longitude,
              } : undefined}
              height="100%"
            />
          </div>

          {/* Harita üstü — adres kartı */}
          <div className="absolute top-3 left-3 right-14 z-[400]">
            <div className="rounded-xl px-4 py-2.5 shadow-md border backdrop-blur-sm"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', opacity: 0.95 }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={sStyle}>Teslimat Adresi</p>
              <p className="text-sm font-semibold truncate" style={pStyle}>
                {order?.deliveryAddress ?? 'Adres yükleniyor...'}
              </p>
            </div>
          </div>

          {/* Konum zaman aşımı uyarısı */}
          {locationTimeout && (
            <div className="absolute bottom-4 left-3 right-3 z-[400]">
              <div className="rounded-xl px-4 py-3 bg-amber-50 border border-amber-200 flex items-center gap-2 shadow-md">
                <span className="material-symbols-outlined text-amber-500 text-[20px]">warning</span>
                <span className="text-sm text-amber-700 font-medium">Kurye konumu geçici olarak alınamıyor...</span>
              </div>
            </div>
          )}
        </div>

        {/* ── DURUM PANELİ ── */}
        <div className="w-full md:w-2/5 h-1/2 md:h-full overflow-y-auto flex flex-col shadow-[-8px_0_24px_rgba(0,0,0,0.04)] md:shadow-none relative"
          style={{ backgroundColor: 'var(--bg-page)' }}>

          {/* Mobil sürükleme tutacağı */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
          </div>

          <div className="p-5 md:p-6 flex flex-col gap-6 flex-1">

            {/* ETA */}
            {!isDelivered && !isFailed && (
              <div>
                <p className="text-4xl font-black" style={aStyle}>{ETA[currentStatus]}</p>
                <p className="text-sm mt-1" style={sStyle}>Tahmini Teslimat Süresi</p>
              </div>
            )}

            {/* Teslim edildi banner */}
            {isDelivered && (
              <div className="rounded-2xl p-5 text-center text-white shadow-md" style={{ backgroundColor: 'var(--accent)' }}>
                <span className="material-symbols-outlined text-[48px] mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>celebration</span>
                <h3 className="text-lg font-black mb-1">Siparişin Teslim Edildi! 🎉</h3>
                <p className="text-sm opacity-80">Afiyet olsun. Götür'ü tercih ettiğin için teşekkürler.</p>
              </div>
            )}

            {/* İptal banner */}
            {isFailed && (
              <div className="rounded-2xl p-5 text-center bg-red-50 border border-red-200">
                <span className="material-symbols-outlined text-[48px] text-red-500 mb-2">cancel</span>
                <h3 className="text-lg font-black text-red-700 mb-1">Sipariş İptal Edildi</h3>
                <p className="text-sm text-red-500">Bir sorun oluştu. Destek ile iletişime geçebilirsin.</p>
              </div>
            )}

            {/* Adım göstergesi */}
            {!isFailed && (
              <div className="relative flex flex-col gap-4">
                {/* Dikey çizgi arkada */}
                <div className="absolute left-[15px] top-4 bottom-4 w-[2px] rounded-full"
                  style={{ backgroundColor: 'var(--border)' }} />
                {/* Dolu kısım — tamamlanan adımlar */}
                <div className="absolute left-[15px] top-4 w-[2px] rounded-full transition-all duration-700"
                  style={{
                    backgroundColor: 'var(--accent)',
                    height: `${Math.min(currentStep / (STEPS.length - 1), 1) * 100}%`,
                  }} />

                {STEPS.map((step, i) => {
                  const done    = i < currentStep
                  const active  = i === currentStep
                  const pending = i > currentStep
                  return (
                    <div key={step.key} className="flex items-start gap-4 relative z-10">
                      {/* Ikon */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-sm ${done || active ? 'shadow-md' : ''}`}
                        style={{
                          backgroundColor: done ? 'var(--accent)' : active ? 'var(--bg-card)' : 'var(--bg-muted)',
                          border: active ? `2px solid var(--accent)` : 'none',
                          color: done ? '#fff' : active ? 'var(--accent)' : 'var(--text-muted)',
                        }}>
                        {done ? (
                          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                        ) : active ? (
                          <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
                        ) : (
                          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>{step.icon}</span>
                        )}
                      </div>
                      {/* Etiket */}
                      <div className={`pt-1 transition-opacity ${pending ? 'opacity-40' : ''}`}>
                        <p className="text-sm font-bold" style={pStyle}>{step.label}</p>
                        {active && (
                          <p className="text-xs font-semibold mt-0.5" style={aStyle}>
                            {step.key === 'Picked' ? 'Size doğru geliyor' : 'Devam ediyor...'}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Kurye kartı — Assigned veya sonrasında */}
            {(currentStep >= 1) && !isFailed && (
              <div className="rounded-2xl p-4 border flex items-center justify-between"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2"
                      style={{ borderColor: 'var(--accent)' }}>
                      <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuC2qOXLABJ3yGL3X17VjVyIz-KttxIT5UIpnSq5WoDo0vijAkR-YMjsYJiNZVZx3SUWFA4KtReoHTE7OvppKh_SsPJbmajVfdugINT2zkGAOWoU9kElaHP9uDhbJ1dAavbZnCrzdtQEEt2GTqUQ1JBx-hE6r8IFhj3yrXCEBA6OiuuDnv-o3MwwNsFJ1adKMpEbdpLSPFOOAZDLi9yNZy18BhsiJzAzYFj7qFbrXI_ssISD9eaIkX7GJunVWN1xjop-znPr1Fn5dbw"
                        alt="Kurye" className="w-full h-full object-cover" />
                    </div>
                    {/* Çevrimiçi nokta */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2"
                      style={{ borderColor: 'var(--bg-card)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={pStyle}>{courierName ?? 'Kurye'}</p>
                    <div className="flex items-center gap-1 text-xs" style={sStyle}>
                      <span className="material-symbols-outlined text-[14px]" style={{ ...aStyle, fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span>4.9</span>
                      <span style={sStyle}>· 120+ teslimat</span>
                    </div>
                  </div>
                </div>
                {/* İletişim butonları */}
                <div className="flex gap-2">
                  <button className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity border"
                    style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--accent)' }}>
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                  </button>
                  <button className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: 'var(--accent)' }}>
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sipariş özeti */}
            {order && (
              <div className="rounded-2xl border overflow-hidden"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="text-sm font-black" style={pStyle}>Sipariş Detayı</h3>
                </div>
                <div className="p-4 space-y-2.5">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm" style={sStyle}>
                        {item.name}
                        <span className="ml-1 font-semibold" style={pStyle}>×{item.quantity}</span>
                      </span>
                      <span className="text-sm font-bold" style={pStyle}>
                        ₺{(item.price * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t flex justify-between items-center"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-muted)' }}>
                  <span className="text-sm font-semibold" style={sStyle}>Toplam</span>
                  <span className="text-lg font-black" style={aStyle}>
                    ₺{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Yeni sipariş ver — teslimden sonra */}
            {isDelivered && (
              <button onClick={() => navigate('/')}
                className="w-full py-3.5 rounded-full text-white font-black text-sm shadow-md hover:opacity-90 transition-opacity active:scale-[0.98]"
                style={{ backgroundColor: 'var(--accent)' }}>
                Yeni Sipariş Ver →
              </button>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
