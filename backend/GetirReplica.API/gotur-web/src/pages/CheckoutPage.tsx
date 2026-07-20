import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authService } from '../services/authService'
import { orderService } from '../services/orderService'
import ThemeToggle from '../components/ThemeToggle'
import api from '../services/api'
import type { OrderItem, Restaurant } from '../types'
import {
  luhnCheck, isExpValid, detectBrand, formatCardNumber, formatExpiry,
  maskCardNumber, getSavedCards, saveCard as persistCard,
  type SavedCard,
} from '../utils/cardUtils'

type PaymentMethod = 'credit_card' | 'wallet' | 'cash'

interface LocationState {
  items?: OrderItem[]
  restaurantId?: string
}

// shorthand style helpers
const pStyle = { color: 'var(--text-primary)' }
const sStyle = { color: 'var(--text-secondary)' }
const aStyle = { color: 'var(--accent)' }
const cardStyle = { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }
const inputStyle = { backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }

export default function CheckoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = authService.getUser()

  // Items passed from RestaurantDetailPage via state, or sample fallback
  const state = location.state as LocationState | null
  const passedItems: OrderItem[] = state?.items ?? [
    { name: 'Coni Nashville Bowl', quantity: 1, price: 487.5 },
    { name: 'Coni Classic Burger',  quantity: 2, price: 395 },
  ]

  // restaurantId: önce state'ten, yoksa API'den çek
  const [restaurantId, setRestaurantId] = useState<string>(state?.restaurantId ?? '')

  useEffect(() => {
    // State'ten geçerli bir UUID gelmediyse API'den ilk restoranı al
    if (!restaurantId || restaurantId.length < 10) {
      api.get<Restaurant[]>('/restaurants')
        .then(r => {
          if (r.data.length > 0) setRestaurantId(r.data[0].id)
        })
        .catch(console.error)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card')
  const [address, setAddress]             = useState('Caferağa Mah. Moda Cad. No: 123 Daire: 4\nKadıköy, İstanbul')
  const [lat, setLat]                     = useState('40.9906')
  const [lng, setLng]                     = useState('29.0287')
  const [cardNumber, setCardNumber]       = useState('')
  const [cardExp, setCardExp]             = useState('')
  const [cardCvv, setCardCvv]             = useState('')
  const [cardHolder, setCardHolder]       = useState('')
  const [saveCard, setSaveCard]           = useState(false)
  const [cardErrors, setCardErrors]       = useState<{ number?: string; exp?: string; cvv?: string; holder?: string }>({})
  const [selectedSaved, setSelectedSaved] = useState<string | null>(null) // kayıtlı kart id
  const [savedCards, setSavedCards]       = useState<SavedCard[]>([])
  const [note, setNote]                   = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  // Kayıtlı kartları yükle
  useEffect(() => {
    if (user) setSavedCards(getSavedCards(user.id))
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal  = passedItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const delivery  = subtotal >= 300 ? 0 : 29.9
  const discount  = subtotal >= 300 ? 29.9 : 0
  const total     = subtotal + delivery - discount

  const handleSubmit = async () => {
    if (!user) { navigate('/login'); return }
    if (!address.trim()) { setError('Teslimat adresi gerekli.'); return }
    if (!restaurantId) { setError('Restoran bilgisi yüklenemedi, lütfen sayfayı yenileyin.'); return }
    if (paymentMethod === 'credit_card' && !selectedSaved) {
      const errs: typeof cardErrors = {}
      const rawNum = cardNumber.replace(/\D/g, '')
      if (rawNum.length !== 16)            errs.number = 'Kart numarası 16 haneli olmalıdır.'
      else if (!luhnCheck(rawNum))         errs.number = 'Geçersiz kart numarası.'
      if (!isExpValid(cardExp))            errs.exp    = 'Geçersiz veya süresi dolmuş tarih.'
      if (cardCvv.length !== 3)            errs.cvv    = 'CVV 3 haneli olmalıdır.'
      if (!cardHolder.trim())              errs.holder = 'Kart üzerindeki isim gerekli.'
      if (Object.keys(errs).length > 0) {
        setCardErrors(errs)
        setError('')
        return
      }
      setCardErrors({})
      // Kaydet
      if (saveCard && user) {
        persistCard(user.id, {
          last4:        cardNumber.replace(/\D/g, '').slice(-4),
          brand:        detectBrand(cardNumber),
          expiry:       cardExp,
          holderName:   cardHolder,
          maskedNumber: maskCardNumber(cardNumber),
        })
      }
    }
    setError('')
    setLoading(true)
    try {
      const order = await orderService.createOrder({
        restaurantId,
        deliveryAddress: address.replace(/\n/g, ' ').trim(),
        deliveryLocation: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
        items: passedItems,
      })
      navigate(`/tracking/${order.id}`)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> }, status?: number } }
      const status = axiosErr.response?.status
      const msg = axiosErr.response?.data?.message
      const errors = axiosErr.response?.data?.errors
      if (status === 409) {
        setError('Zaten aktif bir siparişin var. Önce mevcut siparişinin tamamlanmasını bekle.')
      } else if (errors) {
        setError(Object.values(errors).flat().join(' '))
      } else {
        setError(msg ?? 'Sipariş oluşturulamadı. Lütfen tekrar deneyin.')
      }
    } finally {
      setLoading(false)
    }
  }

  const brandIcon = (brand: SavedCard['brand']) => {
    if (brand === 'visa') return '💳 Visa'
    if (brand === 'mastercard') return '💳 Mastercard'
    if (brand === 'troy') return '💳 Troy'
    return '💳'
  }

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased transition-colors"
      style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}>

      {/* ── HEADER ── */}
      <header className="border-b sticky top-0 z-50 transition-colors" style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-12 h-16 flex items-center justify-center relative">
          <button onClick={() => navigate(-1)} aria-label="Geri"
            className="absolute left-4 md:left-12 p-2 rounded-full hover:opacity-70 transition-opacity flex items-center justify-center"
            style={sStyle}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-black italic select-none" style={aStyle}>Götür</h1>
          <div className="absolute right-4 md:right-12">
            <ThemeToggle />
          </div>
        </div>
        {/* Adım göstergesi */}
        <div className="max-w-7xl mx-auto px-4 md:px-12 pb-3 flex items-center justify-center gap-3">
          {[{ n: 1, label: 'Sepet' }, { n: 2, label: 'Ödeme' }, { n: 3, label: 'Takip' }].map(step => (
            <div key={step.n} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step.n === 2 ? 'text-white' : 'opacity-40'}`}
                style={{ backgroundColor: step.n === 2 ? 'var(--accent)' : 'var(--bg-muted)', color: step.n === 2 ? '#fff' : 'var(--text-secondary)' }}>
                {step.n < 2 ? <span className="material-symbols-outlined text-[14px]">check</span> : step.n}
              </div>
              <span className={`text-xs font-semibold ${step.n === 2 ? '' : 'opacity-40'}`}
                style={step.n === 2 ? aStyle : sStyle}>
                {step.label}
              </span>
              {step.n < 3 && <span className="material-symbols-outlined text-[14px] opacity-30" style={sStyle}>chevron_right</span>}
            </div>
          ))}
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 md:px-12 py-6 md:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

            {/* ── SOL KOLON ── */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>{error}
                </div>
              )}

              {/* Teslimat Adresi */}
              <section>
                <h2 className="text-xl font-black mb-4" style={pStyle}>Teslimat Adresi</h2>
                <div className="rounded-xl p-4 md:p-5 shadow-sm border flex flex-col sm:flex-row gap-4 sm:items-start" style={cardStyle}>
                  {/* Harita önizleme */}
                  <div className="w-full sm:w-32 h-24 rounded-xl overflow-hidden flex-shrink-0 relative border" style={{ borderColor: 'var(--border)' }}>
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1WpucsAioiw80YDSsyRp6YjBt9CvTSCbodbaO7bqv753e1o4UdR-yrwhEUkCDIaQ63Gudp1MFF-hZzwi8UefX0bWN3JHpdXGQ8aAfWHpozDn588-wzOGmObc8Lw_VT58KS9CHxb8ai-HEJW6LZAZstT1fHrLFz7kpsLSjQMq_-7iC9d0AqouuD-yQIx2DLPvccFylMWPV-QhF9lStd1q0CUhehwBx7p1bauCLvZvCBrsZwk3A2B2QUW1M1K5MC3Sb_ozorXBWbgI"
                      alt="Harita" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    <span className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[28px] drop-shadow-md"
                      style={{ ...aStyle, fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  </div>
                  {/* Adres detay */}
                  <div className="flex-grow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold flex items-center gap-2" style={pStyle}>
                          Ev
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>Varsayılan</span>
                        </h3>
                        <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
                          className="mt-1 w-full bg-transparent border-none focus:ring-0 text-sm resize-none outline-none"
                          style={sStyle} />
                      </div>
                      <button className="text-sm font-semibold shrink-0 px-2 py-1 rounded-lg hover:opacity-70 transition-opacity" style={aStyle}>Değiştir</button>
                    </div>
                    <div className="flex items-center gap-1 text-xs mt-2" style={sStyle}>
                      <span className="material-symbols-outlined text-[15px]">schedule</span>
                      Tahmini Teslimat: 15-20 dk
                    </div>
                    {/* Koordinatlar (küçük, geliştiriciye) */}
                    <div className="flex gap-3 mt-3">
                      {[{ label: 'Enlem', val: lat, set: setLat }, { label: 'Boylam', val: lng, set: setLng }].map(f => (
                        <div key={f.label} className="flex-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wide mb-0.5 block" style={sStyle}>{f.label}</label>
                          <input type="number" step="any" value={f.val} onChange={e => f.set(e.target.value)}
                            className="w-full rounded-lg px-2 py-1.5 text-xs border outline-none focus:ring-1 transition-all"
                            style={inputStyle} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Ödeme Yöntemi */}
              <section>
                <h2 className="text-xl font-black mb-4" style={pStyle}>Ödeme Yöntemi</h2>
                <div className="rounded-xl shadow-sm border overflow-hidden" style={cardStyle}>

                  {/* Kredi/Banka Kartı */}
                  <div className={`p-4 md:p-5 border-b transition-colors ${paymentMethod === 'credit_card' ? '' : 'hover:opacity-90'}`}
                    style={{ borderColor: 'var(--border)', backgroundColor: paymentMethod === 'credit_card' ? 'var(--accent-soft)' : 'transparent' }}>
                    <label className="flex items-start gap-4 cursor-pointer">
                      <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{ borderColor: paymentMethod === 'credit_card' ? 'var(--accent)' : 'var(--border)' }}
                        onClick={() => setPaymentMethod('credit_card')}>
                        {paymentMethod === 'credit_card' && (
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                        )}
                      </div>
                      <div className="flex-grow">
                        <span className="text-sm font-bold block" style={pStyle}>Kredi / Banka Kartı</span>
                        <span className="text-xs block mt-0.5" style={sStyle}>Mastercard, Visa, Troy geçerlidir.</span>
                        {paymentMethod === 'credit_card' && (
                          <div className="mt-4 space-y-3 animate-[fadeIn_0.2s_ease-out]">

                            {/* Kayıtlı kartlar */}
                            {savedCards.length > 0 && (
                              <div className="space-y-2 mb-2">
                                <p className="text-xs font-semibold" style={sStyle}>Kayıtlı Kartlarım</p>
                                {savedCards.map(sc => (
                                  <label key={sc.id} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                                    style={{ borderColor: selectedSaved === sc.id ? 'var(--accent)' : 'var(--border)', backgroundColor: selectedSaved === sc.id ? 'var(--accent-soft)' : 'var(--bg-input)' }}>
                                    <input type="radio" name="savedCard" checked={selectedSaved === sc.id}
                                      onChange={() => setSelectedSaved(sc.id)}
                                      style={{ accentColor: 'var(--accent)' }} />
                                    <span className="material-symbols-outlined text-[20px]" style={sStyle}>credit_card</span>
                                    <div className="flex-1">
                                      <p className="text-sm font-bold" style={pStyle}>{sc.maskedNumber}</p>
                                      <p className="text-xs" style={sStyle}>{sc.holderName} · {sc.expiry} · {brandIcon(sc.brand)}</p>
                                    </div>
                                  </label>
                                ))}
                                <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                                  style={{ borderColor: selectedSaved === null ? 'var(--accent)' : 'var(--border)', backgroundColor: selectedSaved === null ? 'var(--accent-soft)' : 'transparent' }}>
                                  <input type="radio" name="savedCard" checked={selectedSaved === null}
                                    onChange={() => setSelectedSaved(null)}
                                    style={{ accentColor: 'var(--accent)' }} />
                                  <span className="text-xs font-semibold" style={pStyle}>+ Yeni kart ekle</span>
                                </label>
                              </div>
                            )}

                            {/* Yeni kart formu */}
                            {selectedSaved === null && (
                              <>
                                {/* Kart numarası */}
                                <div className="relative">
                                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px]" style={sStyle}>credit_card</span>
                                  <input value={cardNumber}
                                    onChange={e => {
                                      setCardNumber(formatCardNumber(e.target.value))
                                      setCardErrors(p => ({ ...p, number: undefined }))
                                    }}
                                    placeholder="Kart Numarası" maxLength={19}
                                    className="w-full rounded-xl py-3 pl-10 pr-3 text-sm border outline-none focus:ring-1 transition-all"
                                    style={{ ...inputStyle, borderColor: cardErrors.number ? '#e53e3e' : 'var(--border)' }} />
                                  {cardNumber.replace(/\D/g,'').length >= 4 && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase" style={sStyle}>
                                      {detectBrand(cardNumber) === 'visa' ? 'VISA' : detectBrand(cardNumber) === 'mastercard' ? 'MC' : detectBrand(cardNumber) === 'troy' ? 'TROY' : ''}
                                    </span>
                                  )}
                                </div>
                                {cardErrors.number && <p className="text-xs text-red-500 -mt-1">{cardErrors.number}</p>}

                                {/* Kart sahibi */}
                                <input value={cardHolder}
                                  onChange={e => {
                                    setCardHolder(e.target.value.toUpperCase())
                                    setCardErrors(p => ({ ...p, holder: undefined }))
                                  }}
                                  placeholder="Kart Üzerindeki İsim"
                                  className="w-full rounded-xl py-3 px-3 text-sm border outline-none focus:ring-1 transition-all"
                                  style={{ ...inputStyle, borderColor: cardErrors.holder ? '#e53e3e' : 'var(--border)' }} />
                                {cardErrors.holder && <p className="text-xs text-red-500 -mt-1">{cardErrors.holder}</p>}

                                {/* Son kullanma + CVV */}
                                <div className="flex gap-3">
                                  <div className="flex-1">
                                    <input value={cardExp}
                                      onChange={e => {
                                        setCardExp(formatExpiry(e.target.value))
                                        setCardErrors(p => ({ ...p, exp: undefined }))
                                      }}
                                      placeholder="AA / YY" maxLength={7}
                                      className="w-full rounded-xl py-3 px-3 text-sm border outline-none focus:ring-1 transition-all text-center"
                                      style={{ ...inputStyle, borderColor: cardErrors.exp ? '#e53e3e' : 'var(--border)' }} />
                                    {cardErrors.exp && <p className="text-xs text-red-500 mt-1">{cardErrors.exp}</p>}
                                  </div>
                                  <div className="flex-1 relative">
                                    <input value={cardCvv}
                                      onChange={e => {
                                        setCardCvv(e.target.value.replace(/\D/g,'').slice(0,3))
                                        setCardErrors(p => ({ ...p, cvv: undefined }))
                                      }}
                                      placeholder="CVV" maxLength={3} type="password"
                                      className="w-full rounded-xl py-3 pl-3 pr-10 text-sm border outline-none focus:ring-1 transition-all text-center"
                                      style={{ ...inputStyle, borderColor: cardErrors.cvv ? '#e53e3e' : 'var(--border)' }} />
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] cursor-help" style={sStyle}
                                      title="Kartınızın arkasındaki 3 haneli güvenlik kodu">info</span>
                                    {cardErrors.cvv && <p className="text-xs text-red-500 mt-1">{cardErrors.cvv}</p>}
                                  </div>
                                </div>

                                {/* Kaydet checkbox */}
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <input type="checkbox" checked={saveCard} onChange={e => setSaveCard(e.target.checked)}
                                    className="rounded w-4 h-4" style={{ accentColor: 'var(--accent)' }} />
                                  <span className="text-xs group-hover:opacity-70 transition-opacity" style={sStyle}>Kart bilgilerimi sonraki alışverişlerim için kaydet</span>
                                </label>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>

                  {/* Götür Cüzdan */}
                  <div className={`p-4 md:p-5 border-b transition-colors ${paymentMethod === 'wallet' ? '' : 'hover:opacity-90'}`}
                    style={{ borderColor: 'var(--border)', backgroundColor: paymentMethod === 'wallet' ? 'var(--accent-soft)' : 'transparent' }}>
                    <label className="flex items-center gap-4 cursor-pointer" onClick={() => setPaymentMethod('wallet')}>
                      <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{ borderColor: paymentMethod === 'wallet' ? 'var(--accent)' : 'var(--border)' }}>
                        {paymentMethod === 'wallet' && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />}
                      </div>
                      <div className="flex-grow flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold block" style={pStyle}>Götür Cüzdan</span>
                          <span className="text-xs mt-0.5 block" style={sStyle}>Bakiye: ₺45,00</span>
                        </div>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--accent)' }}>
                          <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Kapıda Ödeme */}
                  <div className={`p-4 md:p-5 transition-colors ${paymentMethod === 'cash' ? '' : 'hover:opacity-90'}`}
                    style={{ backgroundColor: paymentMethod === 'cash' ? 'var(--accent-soft)' : 'transparent' }}>
                    <label className="flex items-center gap-4 cursor-pointer" onClick={() => setPaymentMethod('cash')}>
                      <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{ borderColor: paymentMethod === 'cash' ? 'var(--accent)' : 'var(--border)' }}>
                        {paymentMethod === 'cash' && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />}
                      </div>
                      <div className="flex-grow flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold block" style={pStyle}>Kapıda Ödeme</span>
                          <span className="text-xs mt-0.5 block" style={sStyle}>Nakit veya Kredi Kartı ile</span>
                        </div>
                        <span className="material-symbols-outlined text-[22px]" style={sStyle}>payments</span>
                      </div>
                    </label>
                  </div>
                </div>
              </section>

              {/* Sipariş Notu */}
              <section>
                <div className="rounded-xl p-4 shadow-sm border" style={cardStyle}>
                  <label className="text-sm font-bold flex items-center gap-2 mb-3" style={pStyle} htmlFor="order-note">
                    <span className="material-symbols-outlined text-[18px]" style={sStyle}>edit_note</span>
                    Sipariş Notu Ekle
                  </label>
                  <textarea id="order-note" value={note} onChange={e => setNote(e.target.value)} rows={2}
                    placeholder="Restoran veya kurye için bir notunuz var mı?"
                    className="w-full rounded-xl py-2.5 px-3 text-sm border outline-none focus:ring-1 transition-all resize-none"
                    style={inputStyle} />
                </div>
              </section>
            </div>

            {/* ── SAĞ KOLON — ÖZET ── */}
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="sticky top-24 flex flex-col gap-4">
                <div className="rounded-xl p-4 md:p-5 shadow-sm border flex flex-col" style={cardStyle}>
                  <h2 className="text-lg font-black pb-4 mb-4 border-b" style={{ ...pStyle, borderColor: 'var(--border)' }}>
                    Sipariş Özeti
                  </h2>

                  {/* Ürünler */}
                  <div className="flex flex-col gap-4 max-h-[280px] overflow-y-auto pr-1"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
                    {passedItems.map((item, i) => (
                      <div key={i} className="flex justify-between items-start gap-3">
                        <div className="flex gap-3">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold border"
                            style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                            {item.quantity}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold leading-tight" style={pStyle}>{item.name}</h4>
                            <p className="text-xs mt-0.5" style={sStyle}>{item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ / adet</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold whitespace-nowrap shrink-0" style={pStyle}>
                          ₺{(item.price * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="h-px my-4" style={{ backgroundColor: 'var(--border)' }} />

                  {/* Fiyat dökümü */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex justify-between text-sm" style={sStyle}>
                      <span>Ara Toplam</span>
                      <span>₺{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm" style={sStyle}>
                      <span className="flex items-center gap-1">
                        Teslimat Ücreti
                        <span className="material-symbols-outlined text-[13px] cursor-help" title="300₺ üzeri siparişlerde ücretsiz">info</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {delivery === 0 ? (
                          <>
                            <span className="line-through opacity-50">₺29,90</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>
                              Ücretsiz
                            </span>
                          </>
                        ) : (
                          <span>₺{delivery.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        )}
                      </div>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm font-semibold" style={aStyle}>
                        <span>Sepet İndirimi</span>
                        <span>-₺{discount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>

                  <div className="h-px my-4" style={{ backgroundColor: 'var(--border)' }} />

                  {/* Toplam */}
                  <div className="flex justify-between items-end mb-6">
                    <span className="text-lg font-black" style={pStyle}>Toplam</span>
                    <div className="text-right">
                      <span className="block text-[11px] mb-1" style={sStyle}>KDV Dahil</span>
                      <span className="text-2xl font-black" style={aStyle}>₺{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Ödeme özeti badge */}
                  <div className="flex items-center gap-2 p-3 rounded-xl mb-5 text-xs font-semibold" style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                    <span className="material-symbols-outlined text-[18px]" style={aStyle}>
                      {paymentMethod === 'credit_card' ? 'credit_card' : paymentMethod === 'wallet' ? 'account_balance_wallet' : 'payments'}
                    </span>
                    <span>
                      {paymentMethod === 'credit_card' ? 'Kredi / Banka Kartı ile ödeme' :
                       paymentMethod === 'wallet'      ? 'Götür Cüzdan ile ödeme (Bakiye: ₺45,00)' :
                                                         'Kapıda Ödeme seçildi'}
                    </span>
                  </div>

                  {/* CTA */}
                  <button onClick={handleSubmit} disabled={loading}
                    className="w-full text-white py-4 rounded-full text-sm font-black transition-all active:scale-[0.98] hover:opacity-90 shadow-md disabled:opacity-60 flex items-center justify-center gap-2 group"
                    style={{ backgroundColor: 'var(--accent)' }}>
                    {loading ? (
                      <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />Sipariş veriliyor...</>
                    ) : (
                      <>Siparişi Tamamla <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span></>
                    )}
                  </button>

                  <p className="text-center text-xs mt-3" style={sStyle}>
                    Sipariş vererek{' '}
                    <a href="#" className="underline hover:opacity-70 transition-opacity" style={aStyle}>Kullanım Koşulları</a>'nı
                    kabul etmiş olursunuz.
                  </p>
                </div>

                {/* Güven rozetleri */}
                <div className="rounded-xl p-4 border" style={cardStyle}>
                  <div className="flex justify-around">
                    {[
                      { icon: 'lock', label: 'Güvenli Ödeme' },
                      { icon: 'verified_user', label: 'SSL Şifreli' },
                      { icon: 'support_agent', label: '7/24 Destek' },
                    ].map(b => (
                      <div key={b.icon} className="flex flex-col items-center gap-1 text-center">
                        <span className="material-symbols-outlined text-[22px]" style={aStyle}>{b.icon}</span>
                        <span className="text-[10px] font-semibold" style={sStyle}>{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
