import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { orderService } from '../services/orderService'
import { authService } from '../services/authService'
import api from '../services/api'
import type { OrderItem } from '../types'

interface Restaurant { id: string; name: string; address: string }

const POPULAR_ITEMS = [
  { name: 'Döner', price: 150 },
  { name: 'Lahmacun', price: 60 },
  { name: 'Pide', price: 90 },
  { name: 'Köfte', price: 120 },
  { name: 'İçecek', price: 25 },
]

export default function CustomerPage() {
  const navigate = useNavigate()
  const user = authService.getUser()
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('40.9906')
  const [lng, setLng] = useState('29.0287')
  const [items, setItems] = useState<OrderItem[]>([{ name: 'Döner', quantity: 1, price: 150 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'order' | 'confirm'>('order')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('')

  useEffect(() => {
    api.get<Restaurant[]>('/restaurants')
      .then(r => {
        setRestaurants(r.data)
        if (r.data.length > 0) setSelectedRestaurant(r.data[0].id)
      })
      .catch(console.error)
  }, [])

  const addQuickItem = (name: string, price: number) => {
    const existing = items.findIndex(i => i.name === name)
    if (existing >= 0) {
      setItems(items.map((it, idx) => idx === existing ? { ...it, quantity: it.quantity + 1 } : it))
    } else {
      setItems([...items, { name, quantity: 1, price }])
    }
  }

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateQty = (i: number, qty: number) => {
    if (qty <= 0) { removeItem(i); return }
    setItems(items.map((it, idx) => idx === i ? { ...it, quantity: qty } : it))
  }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  const handleOrder = async () => {
    setError('')
    if (!address.trim()) { setError('Teslimat adresi gerekli.'); setStep('order'); return }
    if (items.length === 0) { setError('En az bir ürün ekleyin.'); return }
    setLoading(true)
    try {
      const order = await orderService.createOrder({
        restaurantId: selectedRestaurant,
        deliveryAddress: address,
        deliveryLocation: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
        items,
      })
      navigate(`/tracking/${order.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Sipariş oluşturulamadı.')
      setStep('order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#efe6dd]">
      <Navbar />

      {/* Hero */}
      <div className="bg-gradient-to-br from-[#9a0002] to-[#6b0001] text-white px-4 py-10">
        <div className="max-w-2xl mx-auto">
          <p className="text-white/70 text-sm font-medium mb-1">Merhaba, {user?.fullName?.split(' ')[0]} 👋</p>
          <h1 className="text-3xl font-black mb-1">Ne yemek istersin?</h1>
          <p className="text-white/60 text-sm">Hızlı teslimat · Canlı takip · Götür güvencesi</p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 -mt-4 pb-10">

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Step tabs */}
        <div className="flex gap-2 mb-5 bg-white/60 backdrop-blur-sm p-1 rounded-2xl border border-[#e0d6cc]">
          {(['order', 'confirm'] as const).map((s, i) => (
            <button
              key={s}
              onClick={() => s === 'confirm' && items.length > 0 && address ? setStep(s) : setStep('order')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${
                step === s
                  ? 'bg-[#9a0002] text-white shadow-sm'
                  : 'text-[#9a8f85] hover:text-[#1a1a2e]'
              }`}
            >
              <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                step === s ? 'bg-white/20' : 'bg-[#efe6dd]'
              }`}>{i + 1}</span>
              {s === 'order' ? 'Sipariş' : 'Onayla'}
            </button>
          ))}
        </div>

        {step === 'order' && (
          <div className="space-y-4">
            {/* Adres */}
            <div className="bg-white rounded-2xl border border-[#e0d6cc] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-[#9a0002]/10 flex items-center justify-center text-base">📍</div>
                <h2 className="font-bold text-[#1a1a2e]">Teslimat Adresi</h2>
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Sokak, mahalle, ilçe girin..."
                className="w-full px-4 py-3 rounded-xl border border-[#d4c9be] bg-[#faf7f4] text-[#1a1a2e] placeholder-[#c0b5a8] focus:outline-none focus:ring-2 focus:ring-[#9a0002]/25 focus:border-[#9a0002] transition text-sm mb-3"
              />

              {/* Restoran seçimi */}
              {restaurants.length > 0 && (
                <div className="mb-3">
                  <label className="text-xs text-[#9a8f85] block mb-1">Restoran</label>
                  <select
                    value={selectedRestaurant}
                    onChange={(e) => setSelectedRestaurant(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#d4c9be] bg-[#faf7f4] text-sm text-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#9a0002]/25 focus:border-[#9a0002] transition"
                  >
                    {restaurants.map(r => (
                      <option key={r.id} value={r.id}>{r.name} — {r.address}</option>
                    ))}
                  </select>
                </div>
              )}              <div className="grid grid-cols-2 gap-3 mt-3">
                {[{ label: 'Enlem', value: lat, set: setLat }, { label: 'Boylam', value: lng, set: setLng }].map(f => (
                  <div key={f.label}>
                    <label className="text-xs text-[#9a8f85] block mb-1">{f.label}</label>
                    <input
                      type="number" step="any" value={f.value}
                      onChange={(e) => f.set(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#d4c9be] bg-[#faf7f4] text-sm text-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#9a0002]/25 focus:border-[#9a0002] transition"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Hızlı ekleme */}
            <div className="bg-white rounded-2xl border border-[#e0d6cc] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-[#9a0002]/10 flex items-center justify-center text-base">⚡</div>
                <h2 className="font-bold text-[#1a1a2e]">Hızlı Seçim</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {POPULAR_ITEMS.map(item => (
                  <button
                    key={item.name}
                    onClick={() => addQuickItem(item.name, item.price)}
                    className="px-3 py-2 rounded-xl bg-[#faf7f4] border border-[#e0d6cc] text-sm text-[#1a1a2e] hover:border-[#9a0002] hover:bg-[#fff5f5] transition flex items-center gap-2 font-medium"
                  >
                    {item.name}
                    <span className="text-xs text-[#9a8f85] font-normal">₺{item.price}</span>
                    <span className="text-[#9a0002] font-bold">+</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sepet */}
            <div className="bg-white rounded-2xl border border-[#e0d6cc] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#9a0002]/10 flex items-center justify-center text-base">🛒</div>
                  <h2 className="font-bold text-[#1a1a2e]">Sepet</h2>
                  {items.length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#9a0002] text-white text-xs font-bold flex items-center justify-center">
                      {items.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  )}
                </div>
              </div>

              {items.length === 0 ? (
                <div className="py-8 text-center text-[#9a8f85] text-sm">
                  <p className="text-3xl mb-2">🛒</p>
                  Sepet boş — yukarıdan ürün ekleyin
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-[#faf7f4] rounded-xl px-4 py-3">
                      <span className="flex-1 text-sm font-medium text-[#1a1a2e]">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(i, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-white border border-[#e0d6cc] text-[#9a0002] font-bold text-base hover:border-[#9a0002] transition flex items-center justify-center">−</button>
                        <span className="w-6 text-center font-bold text-sm text-[#1a1a2e]">{item.quantity}</span>
                        <button onClick={() => updateQty(i, item.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-[#9a0002] text-white font-bold text-base hover:bg-[#6b0001] transition flex items-center justify-center">+</button>
                      </div>
                      <span className="w-16 text-right text-sm font-semibold text-[#1a1a2e]">
                        ₺{(item.price * item.quantity).toFixed(0)}
                      </span>
                      <button onClick={() => removeItem(i)} className="text-[#c0b5a8] hover:text-red-400 transition text-lg leading-none">×</button>
                    </div>
                  ))}

                  <div className="flex justify-between items-center pt-3 mt-1 border-t border-[#ece4db]">
                    <span className="text-sm text-[#9a8f85]">Toplam</span>
                    <span className="text-xl font-black text-[#9a0002]">₺{total.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (!address.trim()) { setError('Teslimat adresi gerekli.'); return }
                if (items.length === 0) { setError('En az bir ürün ekleyin.'); return }
                setError(''); setStep('confirm')
              }}
              className="w-full py-4 rounded-2xl bg-[#9a0002] hover:bg-[#6b0001] text-white font-black text-base transition shadow-md shadow-[#9a0002]/20 flex items-center justify-center gap-2"
            >
              Siparişi Onayla →
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            {/* Özet */}
            <div className="bg-white rounded-2xl border border-[#e0d6cc] p-5 shadow-sm">
              <h2 className="font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
                <span>📋</span> Sipariş Özeti
              </h2>

              <div className="bg-[#faf7f4] rounded-xl p-4 mb-4">
                <p className="text-xs text-[#9a8f85] uppercase tracking-wide font-medium mb-1">Teslimat Adresi</p>
                <p className="font-medium text-[#1a1a2e] text-sm">{address}</p>
              </div>

              <div className="space-y-2 mb-4">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[#4a4a6a]">{item.name} <span className="text-[#9a8f85]">×{item.quantity}</span></span>
                    <span className="font-semibold text-[#1a1a2e]">₺{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-[#ece4db] flex justify-between items-center">
                <span className="font-bold text-[#1a1a2e]">Toplam</span>
                <span className="text-2xl font-black text-[#9a0002]">₺{total.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-[#9a0002]/5 border border-[#9a0002]/20 rounded-2xl p-4 text-sm text-[#9a0002] flex items-start gap-3">
              <span className="text-xl mt-0.5">🛵</span>
              <p>Siparişini onayladıktan sonra en yakın kurye eşleştirilecek. Canlı takip ekranına yönlendirileceksin.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep('order')}
                className="py-3.5 rounded-2xl border-2 border-[#d4c9be] text-[#4a4a6a] font-bold text-sm hover:border-[#9a0002] hover:text-[#9a0002] transition"
              >
                ← Düzenle
              </button>
              <button
                onClick={handleOrder}
                disabled={loading}
                className="py-3.5 rounded-2xl bg-[#9a0002] hover:bg-[#6b0001] text-white font-black text-sm transition shadow-md shadow-[#9a0002]/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Gönderiliyor...</>
                ) : '🚀 Siparişi Gönder'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
