import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WalletNavbar from '../components/WalletNavbar'
import { orderService } from '../services/orderService'
import { authService } from '../services/authService'
import type { Order } from '../types'

// Durum etiketi ve renk eşleştirmesi
const STATUS_MAP: Record<string, { label: string; icon: string; cls: string }> = {
  Pending:   { label: 'Bekliyor',       icon: 'pending',        cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  Accepted:  { label: 'Kabul Edildi',   icon: 'thumb_up',       cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  PickedUp:  { label: 'Yolda',          icon: 'delivery_dining', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  Delivered: { label: 'Teslim Edildi',  icon: 'check_circle',   cls: 'bg-green-50 text-green-700 border-green-200' },
  Cancelled: { label: 'İptal Edildi',   icon: 'cancel',         cls: 'bg-red-50 text-red-600 border-red-200' },
}

function statusInfo(status: string) {
  return STATUS_MAP[status] ?? { label: status, icon: 'info', cls: 'bg-gray-50 text-gray-600 border-gray-200' }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function totalPrice(order: Order) {
  return order.items.reduce((s, i) => s + i.price * i.quantity, 0)
}

// Material Icon bileşeni
function Icon({ name, filled = false, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
    >
      {name}
    </span>
  )
}

// Restoran adı gösterimi için basit yardımcı — restaurantId kullanılıyor, backend'den isim çekilebilir
function RestaurantInitials({ id: _id }: { id: string }) {
  return (
    <div className="w-14 h-14 rounded-xl bg-[#9a0002]/10 border border-[#9a0002]/20 flex items-center justify-center flex-shrink-0">
      <Icon name="storefront" className="text-[28px] text-[#9a0002]" />
    </div>
  )
}

const PAGE_SIZE = 6

export default function OrdersPage() {
  const navigate = useNavigate()
  const user = authService.getUser()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter])

  const fetchOrders = async () => {
    setLoading(true)
    setError('')
    try {
      const statusParam: Record<string, string | undefined> = {
        all: undefined,
        active: 'Pending,Accepted,PickedUp',
        completed: 'Delivered',
        cancelled: 'Cancelled',
      }
      const params: Record<string, string | number> = { page, pageSize: PAGE_SIZE }
      const s = statusParam[filter]
      if (s) params.status = s
      const result = await orderService.getMyOrders(params)
      if (page === 1) {
        setOrders(result.items)
      } else {
        setOrders(prev => [...prev, ...result.items])
      }
      setTotalCount(result.totalCount)
    } catch {
      setError('Siparişler yüklenirken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (f: typeof filter) => {
    setFilter(f)
    setPage(1)
    setOrders([])
  }

  const handleLoadMore = () => setPage(p => p + 1)
  const hasMore = orders.length < totalCount

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all',       label: 'Tümü' },
    { key: 'active',    label: 'Aktif' },
    { key: 'completed', label: 'Teslim Edildi' },
    { key: 'cancelled', label: 'İptal Edildi' },
  ]

  return (
    <div className="min-h-screen bg-[#fff8f6]">
      <WalletNavbar activePage="orders" />

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 pb-28">
        {/* Sayfa Başlığı */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-black text-[#271815]">Önceki Siparişlerim</h1>
          <p className="text-sm text-[#8f706b] mt-1">Tüm siparişlerini görüntüle ve yönet.</p>
        </div>

        {/* Filtre Tabları */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-all ${
                filter === f.key
                  ? 'bg-[#9a0002] text-white border-[#9a0002] shadow-sm'
                  : 'bg-white text-[#5b403c] border-[#e4beb8] hover:border-[#9a0002] hover:text-[#9a0002]'
              }`}
            >
              {f.label}
            </button>
          ))}
          {totalCount > 0 && (
            <span className="ml-auto flex items-center text-xs text-[#8f706b] whitespace-nowrap px-1">
              {totalCount} sipariş
            </span>
          )}
        </div>

        {/* Hata */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <Icon name="error" className="text-[18px]" /> {error}
          </div>
        )}

        {/* İlk yükleme skeleton */}
        {loading && orders.length === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-[#f0e0dd] animate-pulse">
                <div className="flex gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-[#f9dcd7]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[#f9dcd7] rounded w-1/3" />
                    <div className="h-3 bg-[#f9dcd7] rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-[#f9dcd7] rounded w-3/4" />
                  <div className="h-3 bg-[#f9dcd7] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Boş durum */}
        {!loading && orders.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-[#fff0ee] flex items-center justify-center mb-4">
              <Icon name="receipt_long" className="text-[40px] text-[#9a0002]/40" />
            </div>
            <h3 className="font-bold text-[#271815] text-lg mb-1">Henüz sipariş yok</h3>
            <p className="text-sm text-[#8f706b] max-w-xs mb-6">
              {filter === 'all'
                ? 'Hiç sipariş vermedin. İlk siparişini vermek ister misin?'
                : 'Bu kategoride sipariş bulunamadı.'}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-[#9a0002] text-white rounded-full font-bold text-sm hover:bg-[#6f0001] transition shadow-md"
              >
                Sipariş Ver
              </button>
            )}
          </div>
        )}

        {/* Sipariş Kartları Grid */}
        {orders.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {orders.map(order => {
              const st = statusInfo(order.status)
              const isActive = ['Pending', 'Accepted', 'PickedUp'].includes(order.status)
              const total = totalPrice(order)

              return (
                <article
                  key={order.id}
                  className="bg-white rounded-2xl border border-[#f0e0dd] hover:border-[#9a0002]/30 hover:shadow-md transition-all shadow-[0_2px_8px_rgba(39,24,21,0.06)] flex flex-col"
                >
                  {/* Kart Başlığı */}
                  <div className="p-5 pb-4 border-b border-[#fff0ee] flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <RestaurantInitials id={order.restaurantId} />
                      <div>
                        <h3 className="font-bold text-[#271815] text-base leading-tight">
                          Sipariş #{order.id.slice(0, 8).toUpperCase()}
                        </h3>
                        <p className="text-xs text-[#8f706b] flex items-center gap-1 mt-1">
                          <Icon name="calendar_today" className="text-[13px]" />
                          {formatDate(order.createdAt)}
                        </p>
                        <p className="text-xs text-[#8f706b] flex items-center gap-1 mt-0.5 max-w-[200px] truncate">
                          <Icon name="location_on" className="text-[13px]" />
                          {order.deliveryAddress}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {/* Durum etiketi */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${st.cls}`}>
                        <Icon name={st.icon} filled className="text-[13px]" />
                        {st.label}
                      </span>
                      {/* Toplam fiyat */}
                      <span className="text-lg font-black text-[#9a0002]">
                        ₺{total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Ürün Listesi */}
                  <div className="px-5 py-4 flex-1">
                    <ul className="space-y-1.5">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-[#5b403c]">
                          <span className="w-6 h-5 rounded bg-[#fff0ee] text-[#9a0002] text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {item.quantity}x
                          </span>
                          <span className="flex-1">{item.name}</span>
                          <span className="text-[#8f706b] text-xs font-medium">
                            ₺{(item.price * item.quantity).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Aksiyonlar */}
                  <div className="px-5 pb-5 flex items-center gap-2">
                    {isActive ? (
                      /* Aktif sipariş — takip butonu */
                      <button
                        onClick={() => navigate(`/tracking/${order.id}`)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#9a0002] hover:bg-[#6f0001] text-white rounded-full text-sm font-bold transition shadow-sm"
                      >
                        <Icon name="delivery_dining" className="text-[18px]" />
                        Siparişi Takip Et
                      </button>
                    ) : (
                      /* Tamamlanmış sipariş — tekrar sipariş ver */
                      <button
                        onClick={() => navigate('/checkout', {
                          state: {
                            items: order.items,
                            restaurantId: order.restaurantId,
                          }
                        })}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#9a0002] hover:bg-[#6f0001] text-white rounded-full text-sm font-bold transition shadow-sm"
                      >
                        <Icon name="replay" className="text-[18px]" />
                        Tekrar Sipariş Ver
                      </button>
                    )}

                    {/* Detay butonu */}
                    <button
                      onClick={() => navigate(`/tracking/${order.id}`)}
                      className="px-4 py-3 bg-white border border-[#e4beb8] text-[#5b403c] rounded-full text-sm font-semibold hover:border-[#9a0002] hover:text-[#9a0002] transition whitespace-nowrap"
                    >
                      Detaylar
                    </button>

                    {/* Destek butonu */}
                    <button
                      title="Destek"
                      className="w-10 h-10 flex items-center justify-center rounded-full border border-[#e4beb8] text-[#8f706b] hover:border-[#9a0002] hover:text-[#9a0002] transition flex-shrink-0"
                    >
                      <Icon name="support_agent" className="text-[20px]" />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Daha Fazla Yükle */}
        {hasMore && !loading && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleLoadMore}
              className="px-8 py-3 border border-[#e4beb8] rounded-full text-sm font-semibold text-[#5b403c] hover:border-[#9a0002] hover:text-[#9a0002] transition bg-white"
            >
              Daha Fazla Göster
            </button>
          </div>
        )}

        {/* Sayfalama sırasında yükleme göstergesi */}
        {loading && orders.length > 0 && (
          <div className="mt-8 flex justify-center">
            <span className="animate-spin w-6 h-6 border-2 border-[#9a0002]/30 border-t-[#9a0002] rounded-full inline-block" />
          </div>
        )}
      </main>

      {/* Alt Navigasyon (mobil) */}
      <nav className="fixed bottom-0 left-0 w-full h-16 flex justify-around items-center bg-white border-t border-[#e4beb8] px-4 lg:hidden z-50 rounded-t-xl shadow-lg">
        {[
          { icon: 'home',         label: 'Ana Sayfa', path: '/' },
          { icon: 'search',       label: 'Ara',       path: '/' },
          { icon: 'receipt_long', label: 'Siparişler',path: '/orders', active: true },
          { icon: 'person',       label: 'Profil',    path: '/' },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-0.5 ${
              item.active ? 'text-[#9a0002]' : 'text-[#8f706b]'
            }`}
          >
            <Icon name={item.icon} filled={item.active} className="text-[24px]" />
            <span className="text-[10px] font-semibold">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
