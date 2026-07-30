import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { authService } from '../services/authService'
import { orderService } from '../services/orderService'
import HelpDrawer from '../components/HelpDrawer'
import ThemeToggle from '../components/ThemeToggle'
import api from '../services/api'
import type { Restaurant } from '../types'
import { useAddress } from '../context/AddressContext'

const CAMPAIGNS = [
  { src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJ-O91j0bsm7n7YnWinyNPttecnXGULxJaOvfGSET7O4wr2y9BQ4hr_fyf1ZxX8jVvLVDZfZVO_GQJ91ECGTj_T76AGy9GEMagESyX-JEk16edmdwFSbBjD9KJ2eDJnjFxAYiFIXKyDYxr6BsE7oyp5bAcLxkFAThvh6K54SLwkZq96GGLh-U4MOXae4H-4KmfhuWITxj6FJOyfpd5Vf-NzLhI3XjIraGw1fBmRzVuuYwr-1WNz0JktADFmuz26rvc-xLFFTMKPrQ' },
  { src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBmxHlIH_TQ4dGLa6cEi6SVmUHy0A6a_232Mb4yNG32qy73hnx_mE0W7IhXbz6ubMf92MXScDZCtQ_Gt2k2sfQWcnUJuWEkE_r3fpCfMSt1TGI6u-I5arEUQTYzjLF0879uITt-q-uMa6sii29U1P29ejfbM3fQjUm9A-wRfDKwGtBSmZWzrXVzztrH9DLNjPvaWcFiZZghyZT90LcYPvDrdis-31lGNIiehrDC0-Aik7sF6_Vkt5Y2tn46oULMSkKgNUVKnIsrsJw' },
  { src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpBOMa05w2MDhbOZTxWuSSDbrR0ZK0joiTUXX0bP8eKrk9egHNcLRkjGsrDj6c6Ppq663R7-GMRuZX5CntDJen_ayENzG29CXaFjLboPA_Z8CtbnpWkm3AD3FDX3-76arRpcV0JjzQR0fPpJyD5zkE9IDToi3RXcQ12a4PNCMMCq4iYx1n6sfKG4tKZvH23czGqESV3jKoltZJ9qz3ZM2fdCrpQAZpTR9lyF5ovCRsO7sHUI0xzon0-5HxnuloK8SVTE8X2bo0c-o' },
  { src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBKdY1yBHICNgMLat9_ODvQfjdJnMtJ71HgoUzLpy81kvhrQF4NnCmhooileh4XUCeiAtLGFD5Mc_8fAOLJytROiREqqlUQuKt7yUiH1DRx9vGkFwW_buDfufPRxmm0PRWsmXnnwXjua9xmu2sM90HVABf4QpIisY1drwlFJPc_dXzwFa8olSS2YN0-Ra5J-p_mbpuriDD6_HHq8jF_MLu2bFKirciCK-AQ7yHQiH52rQhp5KW1oWujA5z-Zatb1sRnUB_bFig0--g' },
]

// Mock restoranlar — Etimesgut/Ankara gerçek lokantaları
const MOCK_RESTAURANTS: Restaurant[] = [
  // Etimesgut çevresi — gerçek lokantalar
  { id: 'mock-1', name: 'Çağdaş Pide Kebap Salonu', address: 'Atakent Mah. Şht. Celal İşen Sk. No:2, Etimesgut', description: 'Etimesgut\'un vazgeçilmez pide ve kebap durağı. Odun ateşinde kavurmalı pide.', logoUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop', isOpen: true, locationLat: 39.9478, locationLng: 32.6612 },
  { id: 'mock-2', name: 'Annem Elvan Sofrası',       address: 'Elvan Mah. Ahi Elvan Cd. No:2/C, Etimesgut',       description: 'Ev sıcaklığında günlük yemekler. Taze hazırlanan tabldot ve ev yemekleri.', logoUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop', isOpen: true, locationLat: 39.9410, locationLng: 32.6720 },
  { id: 'mock-3', name: 'Meşhur Ciğerci İdris Usta', address: 'Elvan Mah. Ahi Elvan Cd. No:34/B, Etimesgut',      description: 'Etimesgut\'un efsane ciğercisi. Taze dana ciğeri ve el yapımı köfte.', logoUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop', isOpen: true, locationLat: 39.9418, locationLng: 32.6708 },
  { id: 'mock-4', name: 'Hocam Piknik',              address: 'Piyade Mah. İstasyon Cad. No:215, Etimesgut',       description: 'Etimesgut\'un gözde mangal restoranı. Közde taze etler, bahçede yemek keyfi.', logoUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop', isOpen: true, locationLat: 39.9502, locationLng: 32.6648 },
  { id: 'mock-5', name: 'Çağdaş Pide Kebap - Atakent', address: 'Atakent, 1478. Cad. No:1, Etimesgut',            description: 'Geleneksel Türk mutfağından seçme kebap ve pide çeşitleri.', logoUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=400&fit=crop', isOpen: true, locationLat: 39.9465, locationLng: 32.6635 },
  // Ankara merkez — adres seçilmeden gösterilir, adres girilince filtre kapsar
  { id: 'mock-6', name: 'Bolu Akın Lokantası',       address: 'Kızılay, Çankaya, Ankara',                         description: 'Bolu usulü geleneksel Türk yemekleri. Kuzu incik, pilav ve mevsim tatlıları.', logoUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop', isOpen: true, locationLat: 39.9208, locationLng: 32.8541 },
  { id: 'mock-7', name: 'Mezzaluna Bilkent',         address: 'Bilkent, Çankaya, Ankara',                         description: 'Ankara\'nın en iyi İtalyan mutfağı. Taze makarna ve ahşap fırında pizza.', logoUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=400&fit=crop', isOpen: true, locationLat: 39.8730, locationLng: 32.7490 },
  { id: 'mock-8', name: 'Uludağ İskender Ankara',    address: 'Bahçelievler, Çankaya, Ankara',                    description: 'Bursa usulü gerçek İskender kebabı, tereyağı ve domates sosuyla.', logoUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=400&fit=crop', isOpen: true, locationLat: 39.9300, locationLng: 32.8200 },
]

/* ── Haversine mesafe (km) ── */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const DELIVERY_RADIUS_KM = 10000 // Teslimat yarıçapı artırıldı

const TEST_ACCOUNTS = [
  { icon: '🛒', label: 'Müşteri',  sub: 'Test123!',   email: 'musteri@test.com',  password: 'Test123!'  },
  { icon: '🛵', label: 'Kurye',    sub: 'Test123!',   email: 'kurye1@test.com',   password: 'Test123!'  },
  { icon: '🍽️', label: 'Restoran', sub: 'Test123!',   email: 'restoran@test.com', password: 'Test123!'  },
  { icon: '⚙️', label: 'Admin',    sub: 'Admin123!',  email: 'admin@getir.com',   password: 'Admin123!' },
]

const roleLabel: Record<string, string> = { customer: 'Müşteri', courier: 'Kurye', admin: 'Admin', restaurant: 'Restoran' }
const roleIcon:  Record<string, string>  = { customer: '🛒', courier: '🛵', admin: '🔧', restaurant: '🍽️' }

interface LocationState { openLogin?: boolean; returnTo?: string }
type AuthMode = 'login' | 'register'

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = authService.getUser()
  const { selectedAddress, openPicker } = useAddress()

  const [promoBanner, setPromoBanner] = useState(true)
  const [promoCard,   setPromoCard]   = useState(true)
  const [activeTab,   setActiveTab]   = useState<'restaurants'|'pickup'|'groceries'>('restaurants')
  const [sortBy,      setSortBy]      = useState<'recommended'|'time'|'distance'>('recommended')
  const [favorites,   setFavorites]   = useState<Set<string>>(new Set())
  const [helpOpen,    setHelpOpen]    = useState(false)
  const [helpSearch,  setHelpSearch]  = useState('')
  const [apiRests,    setApiRests]    = useState<Restaurant[]>([])
  const [userMenu,    setUserMenu]    = useState(false)
  const [activeOrder, setActiveOrder] = useState<{ id: string; status: string; restaurantName?: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Aktif sipariş kontrolü — kullanıcı giriş yapmışsa veya sayfaya her gelinişte
  useEffect(() => {
    if (!user || user.role !== 'customer') { setActiveOrder(null); return }
    orderService.getActiveOrder()
      .then(order => {
        setActiveOrder(order ? { id: order.id, status: order.status } : null)
      })
      .catch((err) => {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 401) { setActiveOrder(null); return } // token expired, sessizce geç
        // /orders/active yoksa fallback: kendi siparişlerinden aktif olanı bul
        orderService.getMyOrders({ page: 1, pageSize: 20 })
          .then(res => {
            const active = res.items.find(o => ['Pending', 'ReadyForPickup', 'Assigned', 'Picked'].includes(o.status))
            setActiveOrder(active ? { id: active.id, status: active.status } : null)
          })
          .catch(() => {})
      })
  }, [user?.id, location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const [authOpen,      setAuthOpen]      = useState(false)
  const [authMode,      setAuthMode]      = useState<AuthMode>('login')
  const [authEmail,     setAuthEmail]     = useState('')
  const [authPass,      setAuthPass]      = useState('')
  const [authName,      setAuthName]      = useState('')
  const [authRole,      setAuthRole]      = useState('customer')
  const [remember,      setRemember]      = useState(false)
  const [authLoading,   setAuthLoading]   = useState(false)
  const [authError,     setAuthError]     = useState('')
  const [showTestAccts, setShowTestAccts] = useState(false)

  useEffect(() => {
    const state = location.state as LocationState | null
    if (state?.openLogin) {
      setAuthOpen(true)
      setAuthMode('login')
      navigate('/', { replace: true, state: {} })
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get<Restaurant[]>('/restaurants').then(r => setApiRests(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenu(false)
    }
    if (userMenu) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [userMenu])

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode)
    setAuthEmail(''); setAuthPass(''); setAuthName(''); setAuthRole('customer')
    setAuthError(''); setShowTestAccts(false); setAuthOpen(true)
  }
  const closeAuth = () => { setAuthOpen(false); setAuthError(''); setShowTestAccts(false) }

  // Google OAuth — credential (id_token) ile backend doğrulaması
  const handleGoogleCredential = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setAuthError('Google kimlik bilgisi alınamadı.')
      return
    }
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await authService.googleLogin(credentialResponse.credential)
      authService.saveSession(res)
      closeAuth()
      switch (res.user.role) {
        case 'admin':      navigate('/admin');      break
        case 'restaurant': navigate('/restaurant'); break
        case 'courier':    navigate('/courier');    break
        default:           window.location.reload(); break
      }
    } catch {
      setAuthError('Google ile giriş başarısız. Lütfen tekrar deneyin.')
    } finally {
      setAuthLoading(false)
    }
  }
  const fillTest = async (acc: typeof TEST_ACCOUNTS[0]) => {
    setAuthEmail(acc.email); setAuthPass(acc.password); setAuthError(''); setAuthLoading(true)
    try {
      const res = await authService.login({ email: acc.email, password: acc.password })
      authService.saveSession(res); closeAuth()
      switch (res.user.role) {
        case 'admin':      navigate('/admin');      break
        case 'restaurant': navigate('/restaurant'); break
        case 'courier':    navigate('/courier');    break
        default:           window.location.reload(); break
      }
    } catch { setAuthError('Giriş yapılamadı. Backend çalışıyor mu?') }
    finally  { setAuthLoading(false) }
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(''); setAuthLoading(true)
    try {
      let res
      if (authMode === 'login') {
        res = await authService.login({ email: authEmail, password: authPass })
      } else {
        res = await authService.register({ email: authEmail, password: authPass, fullName: authName, role: authRole })
      }
      authService.saveSession(res); closeAuth()
      switch (res.user.role) {
        case 'admin':      navigate('/admin');      break
        case 'restaurant': navigate('/restaurant'); break
        case 'courier':    navigate('/courier');    break
        default:           window.location.reload(); break
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: string[] } } }
      const data = e?.response?.data
      const identityErrorMap: Record<string, string> = {
        'Passwords must have at least one digit': 'Şifre en az bir rakam içermelidir.',
        'Passwords must be at least':             'Şifre en az 6 karakter olmalıdır.',
        'Email':                                  'Bu e-posta adresi zaten kullanımda.',
        'is already taken':                       'Bu e-posta adresi zaten kullanımda.',
        'DuplicateUserName':                      'Bu e-posta adresi zaten kullanımda.',
        'DuplicateEmail':                         'Bu e-posta adresi zaten kullanımda.',
        'PasswordRequiresDigit':                  'Şifre en az bir rakam içermelidir.',
        'PasswordTooShort':                       'Şifre en az 6 karakter olmalıdır.',
      }
      if (data?.errors && data.errors.length > 0) {
        const raw = data.errors[0]
        const mapped = Object.entries(identityErrorMap).find(([k]) => raw.includes(k))
        setAuthError(mapped ? mapped[1] : raw)
      } else {
        setAuthError(data?.message ?? 'Bir hata oluştu. Lütfen tekrar deneyin.')
      }
    } finally { setAuthLoading(false) }
  }

  // Gerçek restoranlar + mock'lar birleştirilir
  const openRealRests = apiRests.filter(r => r.isOpen)
  const allRests = [...openRealRests, ...MOCK_RESTAURANTS]

  // Adres seçiliyse mesafe filtresi uygula, yoksa hepsini göster
  const displayRests = selectedAddress
    ? allRests.filter(r =>
        haversineKm(selectedAddress.lat, selectedAddress.lng, r.locationLat, r.locationLng) <= DELIVERY_RADIUS_KM
      )
    : allRests

  // Sıralama
  const sorted = [...displayRests].sort((a, b) => {
    if (sortBy === 'distance' && selectedAddress) {
      return haversineKm(selectedAddress.lat, selectedAddress.lng, a.locationLat, a.locationLng)
           - haversineKm(selectedAddress.lat, selectedAddress.lng, b.locationLat, b.locationLng)
    }
    if (sortBy === 'time') return a.name.localeCompare(b.name)
    return 0
  })

  const toggleFav    = (e: React.MouseEvent, name: string) => {
    e.stopPropagation()
    setFavorites(p => { const s = new Set(p); s.has(name) ? s.delete(name) : s.add(name); return s })
  }
  const goRestaurant = (id: string) => {
    if (id.startsWith('mock')) {
      const mock = MOCK_RESTAURANTS.find(r => r.id === id)
      navigate(`/restaurants/${id}`, { state: { mockRestaurant: mock } })
    } else {
      navigate(`/restaurants/${id}`)
    }
  }
  const handleLogout = () => { setUserMenu(false); authService.logout(); navigate('/') }

  const menuItems = [
    { icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4" style={{ color: 'var(--text-muted)' }}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>), label: 'Cüzdan', action: () => { setUserMenu(false); navigate('/wallet') } },
    { icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4" style={{ color: 'var(--text-muted)' }}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>), label: 'Önceki Siparişlerim', action: () => { setUserMenu(false); navigate('/orders') } },
    { icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4" style={{ color: 'var(--text-muted)' }}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>), label: 'Hesabım', action: () => { setUserMenu(false); navigate('/account') } },
    { icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4" style={{ color: 'var(--text-muted)' }}><rect x="1" y="6" width="22" height="13" rx="2"/><path d="M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="12.01"/><line x1="8" y1="12" x2="16" y2="12"/></svg>), label: 'Kuponlarım', action: () => { setUserMenu(false) } },
    { icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4" style={{ color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>), label: 'Yardım Merkezi', action: () => { setUserMenu(false); setHelpOpen(true) } },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>

      {/* Promo Banner */}
      {promoBanner && (
        <div className="w-full py-2 px-4 md:px-12 flex justify-center items-center relative" style={{ backgroundColor: '#6f0001', color: '#fff' }}>
          <button onClick={() => navigate('/partner/apply')} className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">storefront</span>
            <span className="text-xs font-bold tracking-wide">RESTORAN ORTAĞIMIZ OLUN</span>
          </button>
          <button onClick={() => setPromoBanner(false)} className="absolute right-4 md:right-12 opacity-80 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Aktif Sipariş Banner */}
      {activeOrder && (
        <div className="w-full px-4 md:px-12 py-3 flex items-center justify-between gap-3"
          style={{ backgroundColor: activeOrder.status === 'Picked' ? '#1a4731' : '#6f0001', color: '#fff' }}>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
            <span className="text-sm font-semibold">
              {activeOrder.status === 'Pending'        && '🍳 Siparişin hazırlanıyor...'}
              {activeOrder.status === 'ReadyForPickup' && '✅ Sipariş hazır, kurye bekleniyor...'}
              {activeOrder.status === 'Assigned'       && '🛵 Kurye siparişini almak üzere...'}
              {activeOrder.status === 'Picked'         && '🚀 Siparişin yolda, az kaldı!'}
            </span>
          </div>
          <button
            onClick={() => navigate(`/tracking/${activeOrder.id}`)}
            className="text-xs font-bold px-4 py-1.5 rounded-full flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}>
            Takip Et →
          </button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 shadow-sm border-b" style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-12 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-start">
            <button onClick={() => navigate('/')} className="text-2xl font-black italic tracking-tight" style={{ color: 'var(--accent)' }}>Götür</button>
            <button onClick={openPicker} className="flex items-center gap-1 text-sm hover:opacity-70 transition-opacity flex-1 md:flex-none justify-center md:justify-start" style={{ color: 'var(--text-primary)' }}>
              <span className="material-symbols-outlined text-[18px] flex-shrink-0" style={{ color: 'var(--accent)' }}>location_on</span>
              <span className="font-semibold truncate max-w-[180px] md:max-w-[200px]">
                {selectedAddress ? selectedAddress.fullAddress.split(',')[0] : 'Teslimat Adresi Seçin'}
              </span>
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">expand_more</span>
            </button>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px]" style={{ color: 'var(--text-muted)' }}>search</span>
              <input className="w-full pl-10 pr-4 py-2.5 rounded-full border text-sm outline-none transition-all"
                style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                placeholder="Yemek, mutfak veya restoran ara" />
            </div>
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <div className="relative" ref={menuRef}>
                  <button onClick={() => setUserMenu(o => !o)} className="flex items-center gap-2 px-3 py-2 rounded-full transition-colors select-none hover:opacity-80" style={{ color: 'var(--text-primary)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold">{user.fullName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                      {roleLabel[user.role] ?? user.role}
                    </span>
                    <svg className={`w-4 h-4 transition-transform duration-200 ${userMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {userMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                      <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl z-50 overflow-hidden border"
                        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.13)', animation: 'dropIn .15s ease-out' }}>
                        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full text-white font-bold text-base flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
                              {user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{user.fullName}</p>
                              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                            </div>
                          </div>
                          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: 'var(--accent)' }}>
                            <span>{roleIcon[user.role] ?? '👤'}</span>
                            <span>{roleLabel[user.role] ?? user.role}</span>
                          </div>
                        </div>
                        <ul className="py-1.5">
                          {menuItems.map(item => (
                            <li key={item.label}>
                              <button onClick={item.action} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left" style={{ color: 'var(--text-primary)' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-muted)')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                                <span className="flex-shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                                <span>{item.label}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="border-t py-1.5" style={{ borderColor: 'var(--border)' }}>
                          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left" style={{ color: '#e53e3e' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-muted)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                            <span className="flex-shrink-0 flex items-center justify-center w-5">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                              </svg>
                            </span>
                            <span>Çıkış yap</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <button onClick={() => openAuth('login')} className="px-5 py-2 rounded-full border text-sm font-semibold transition-colors hover:opacity-80" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Giriş Yap</button>
                  <button onClick={() => openAuth('register')} className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-colors hover:opacity-80" style={{ backgroundColor: 'var(--accent)' }}>Kayıt Ol</button>
                </>
              )}
              <ThemeToggle />
              <button onClick={() => user ? navigate('/orders') : openAuth('login')} className="p-2 rounded-full transition-colors hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
                <span className="material-symbols-outlined">shopping_bag</span>
              </button>
            </div>
          </div>
        </div>

        {/* Alt Nav */}
        <div className="max-w-7xl mx-auto px-4 md:px-12">
          <nav className="flex items-center gap-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {([
              { key: 'restaurants', icon: 'restaurant',      label: 'Restoranlar' },
              { key: 'pickup',      icon: 'directions_walk', label: 'Al Götür' },
              { key: 'groceries',   icon: 'shopping_cart',   label: 'Market' },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 pb-3 pt-1 px-1 whitespace-nowrap text-sm font-semibold border-b-2 transition-all"
                style={activeTab === tab.key ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : { color: 'var(--text-muted)', borderColor: 'transparent' }}>
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 md:px-12 py-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Sol Sidebar */}
        <aside className="hidden md:block md:col-span-3 space-y-5 sticky top-[110px] h-[calc(100vh-110px)] overflow-y-auto pr-2" style={{ scrollbarWidth: 'none' }}>
          {promoCard && (
            <div className="rounded-xl p-4 border relative" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <button onClick={() => setPromoCard(false)} className="absolute top-2 right-2 opacity-50 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-28 h-28 rounded-xl flex items-center justify-center relative" style={{ backgroundColor: 'var(--bg-muted)' }}>
                  <img className="w-full h-full object-contain rounded-xl"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBohFUiEaJ22V8QpNOvuI6hjKiBcH6fdP_vudYNTsp3l8JBqscZrwx2LXOr72qFaMBTee6BhaUtOQaA438tUnX-KaEj8E8buDriitsTTwD3fkw3a0WAI6qGjk5r1kK7SpMtLsqNle078u_qo3-DvXFNW26mI2m3sJxORvWrlJq9nJrzAMqzKbQphvofZu_YN50vwHFFH2dT0JHSa_TSQrkCam80O8-cUaYUMLGT1LR58pctQCcHuAEhnT5YY-2NKw0XEDKZ8jkQ0XY"
                    alt="QR" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full text-white font-black italic text-sm flex items-center justify-center shadow" style={{ backgroundColor: 'var(--accent)' }}>G</div>
                  </div>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Uygulamaya özel fırsatları yakala. Hemen indir.</p>
                <div className="flex gap-2 w-full">
                  <button className="flex-1 flex items-center justify-center gap-1 border rounded-lg py-2 px-2 text-xs font-medium transition-colors hover:opacity-80" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    <span className="material-symbols-outlined text-[16px]">apps</span>App Store
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 border rounded-lg py-2 px-2 text-xs font-medium transition-colors hover:opacity-80" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>Play Store
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-base font-black mb-4" style={{ color: 'var(--text-primary)' }}>Filtrele</h3>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Sırala</h4>
            <div className="space-y-2.5">
              {([
                { value: 'recommended', label: 'Önerilen (Varsayılan)' },
                { value: 'time',        label: 'Teslimat Süresi' },
                { value: 'distance',    label: 'Mesafe' },
              ] as const).map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                  <input type="radio" name="sort" checked={sortBy === opt.value} onChange={() => setSortBy(opt.value)} className="w-4 h-4" style={{ accentColor: 'var(--accent)' }} />
                  <span className="text-sm group-hover:opacity-70 transition-opacity" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Ana İçerik */}
        <div className="col-span-1 md:col-span-9 space-y-8">
          {/* Uygulama İndirme Banner */}
          <section className="rounded-2xl overflow-hidden relative flex items-center justify-between px-6 md:px-10 py-6 gap-4" style={{ backgroundColor: '#fde8e8', minHeight: '140px' }}>
            {/* Sol: QR + Metin + Butonlar */}
            <div className="flex items-center gap-5 flex-1 min-w-0">
              {/* QR Kodu */}
              <div className="hidden sm:flex flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 bg-white items-center justify-center relative shadow-sm" style={{ borderColor: '#c9a0a0' }}>
                <img
                  className="w-full h-full object-contain p-1"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBohFUiEaJ22V8QpNOvuI6hjKiBcH6fdP_vudYNTsp3l8JBqscZrwx2LXOr72qFaMBTee6BhaUtOQaA438tUnX-KaEj8E8buDriitsTTwD3fkw3a0WAI6qGjk5r1kK7SpMtLsqNle078u_qo3-DvXFNW26mI2m3sJxORvWrlJq9nJrzAMqzKbQphvofZu_YN50vwHFFH2dT0JHSa_TSQrkCam80O8-cUaYUMLGT1LR58pctQCcHuAEhnT5YY-2NKw0XEDKZ8jkQ0XY"
                  alt="QR Kod"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-7 h-7 rounded-full text-white font-black italic text-xs flex items-center justify-center shadow-md" style={{ backgroundColor: '#7c0000' }}>G</div>
                </div>
              </div>
              {/* Metin */}
              <div className="min-w-0">
                <h2 className="text-lg md:text-2xl font-black leading-snug mb-1" style={{ color: '#2d1212' }}>
                  Size özel kampanyalar ve çok<br className="hidden md:block" />
                  daha fazlası <span style={{ color: '#7c0000' }}>Götür Mobil</span> ile
                </h2>
                <p className="text-xs md:text-sm mb-3 leading-relaxed" style={{ color: '#7a4040' }}>
                  Yemekten market ürünlerine ve fazlasına özel fırsatlar Götür'de
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button className="flex items-center gap-1.5 border-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all hover:opacity-80 bg-white" style={{ borderColor: '#2d1212', color: '#2d1212' }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                    App Store
                  </button>
                  <button className="flex items-center gap-1.5 border-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all hover:opacity-80 bg-white" style={{ borderColor: '#2d1212', color: '#2d1212' }}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M3.18 23.76c.3.17.63.24.97.2l13.09-7.37-2.76-2.76-11.3 9.93zM.54 1.43C.2 1.75 0 2.28 0 2.97v18.06c0 .69.2 1.22.54 1.54l.08.08 10.12-10.12v-.24L.62 1.35l-.08.08zM20.48 10.17l-2.79-1.57-3.08 3.08 3.08 3.08 2.81-1.58c.8-.45.8-1.19-.02-1.01zM4.15.24L17.24 7.6l-2.76 2.76L3.18.63c.3-.35.65-.52.97-.39z"/></svg>
                    Play Store
                  </button>
                </div>
              </div>
            </div>
            {/* Sağ: Karakter görseli */}
            <div className="hidden md:flex flex-shrink-0 items-end justify-center h-full" style={{ minWidth: '120px' }}>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDsXZlxv_fzer3A8tRXQjydRXWbeSJiZrU0X7JjnTolCwddXYRyzE6KkHI9Bqnu9MKwAdhz-yDZ-TreeSVt6P-WglTPQ54afsKQrxU_BE7_EqzbWkknvUhAm0LNIx-WuTIE8veacogTncUB8DHJipFv_9F2DjI28mRsmJyJi1ZPzLoogljgHvSpeF4AF0RiPHqRO7mnurbh3Mp3MJ-FnyzCrYG9Ftr17XeD3-_I4Ly-mWsJYtC1-NBMUsiviFBRKaMqtqDTt6bHIg4"
                alt="Uygulama"
                className="h-32 object-contain drop-shadow-md"
              />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black mb-4" style={{ color: 'var(--text-primary)' }}>Kampanyalar</h2>
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {CAMPAIGNS.map((c, i) => (
                <div key={i} className="min-w-[280px] md:min-w-[320px] rounded-xl overflow-hidden border group cursor-pointer flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                  <img className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-500" src={c.src} alt={`Kampanya ${i + 1}`} />
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {selectedAddress ? `${sorted.length} Restoran Bulundu` : 'Tüm Restoranlar'}
                </h2>
                {selectedAddress && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="material-symbols-outlined text-[13px] align-middle mr-0.5">location_on</span>
                    {selectedAddress.fullAddress.split(',')[0]} · {DELIVERY_RADIUS_KM} km içinde
                  </p>
                )}
              </div>
              {!selectedAddress && (
                <button
                  onClick={openPicker}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all hover:opacity-80"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }}
                >
                  <span className="material-symbols-outlined text-[14px]">my_location</span>
                  Konum seç
                </button>
              )}
            </div>

            {/* Adres seçili ama sonuç yok */}
            {selectedAddress && sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <span className="material-symbols-outlined text-[56px]" style={{ color: 'var(--text-muted)' }}>location_off</span>
                <div className="text-center">
                  <p className="font-black text-base" style={{ color: 'var(--text-primary)' }}>Bu bölgede restoran yok</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {DELIVERY_RADIUS_KM} km yarıçapında hizmet veren restoran bulunamadı.
                  </p>
                </div>
                <button
                  onClick={openPicker}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Farklı Adres Seç
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sorted.map(r => {
                const distKm = selectedAddress
                  ? haversineKm(selectedAddress.lat, selectedAddress.lng, r.locationLat, r.locationLng)
                  : null
                return (
                  <div key={r.id} onClick={() => goRestaurant(r.id)}
                    className="rounded-xl overflow-hidden border group cursor-pointer transition-shadow hover:shadow-lg"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="relative h-48 bg-[#fff0ee] flex items-center justify-center overflow-hidden">
                      {r.logoUrl ? (
                        <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={r.logoUrl} alt={r.name} />
                      ) : (
                        <span className="material-symbols-outlined text-[64px]" style={{ color: '#e4beb8' }}>restaurant</span>
                      )}
                      <button onClick={e => toggleFav(e, r.name)} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow z-10" style={{ backgroundColor: 'var(--bg-card)' }}>
                        <span className="material-symbols-outlined text-[18px]"
                          style={{ color: favorites.has(r.name) ? 'var(--accent)' : 'var(--text-muted)', fontVariationSettings: favorites.has(r.name) ? "'FILL' 1" : "'FILL' 0" }}>
                          favorite
                        </span>
                      </button>
                      {/* Mesafe badge */}
                      {distKm !== null && (
                        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold"
                          style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                          <span className="material-symbols-outlined text-[12px]">directions_bike</span>
                          {distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-sm font-black truncate flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                          <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>verified</span>
                          {r.name}
                        </h3>
                      </div>
                      <p className="text-xs mb-1 truncate" style={{ color: 'var(--text-muted)' }}>{r.address}</p>
                      {r.description && (
                        <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{r.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </main>

      {/* Mobil Alt Nav */}
      <nav className="fixed bottom-0 left-0 w-full h-16 flex justify-around items-center border-t lg:hidden z-50 rounded-t-xl" style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
        <button onClick={() => navigate('/')} className="flex flex-col items-center justify-center gap-0.5" style={{ color: 'var(--accent)' }}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
          <span className="text-[10px] font-semibold">Anasayfa</span>
        </button>
        <button className="flex flex-col items-center justify-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined">search</span>
          <span className="text-[10px]">Ara</span>
        </button>
        <button onClick={() => user ? navigate('/orders') : openAuth('login')} className="flex flex-col items-center justify-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined">shopping_bag</span>
          <span className="text-[10px]">Siparişler</span>
        </button>
        <button onClick={() => user ? navigate('/account') : openAuth('login')} className="flex flex-col items-center justify-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px]">Profil</span>
        </button>
      </nav>
      <div className="h-16 lg:hidden" />

      {helpOpen && (
        <HelpDrawer onClose={() => { setHelpOpen(false); setHelpSearch('') }} helpSearch={helpSearch} setHelpSearch={setHelpSearch} />
      )}

      {/* Auth Modal */}
      {authOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row" style={{ animation: 'scaleUp .2s ease-out', maxHeight: '95vh' }}>
            <button onClick={closeAuth} className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            {/* Sol panel */}
            <div className="w-full md:w-5/12 bg-[#1c1c1e] text-white p-8 flex flex-col justify-center items-center text-center relative overflow-hidden flex-shrink-0">
              <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-[#9a0002] opacity-20 blur-3xl pointer-events-none" />
              <h2 className="text-2xl font-bold leading-tight mb-3 tracking-tight">
                Uygulamayı indir,<br /><span className="text-[#ffb4a9]">250 TL indirim</span> kazan
              </h2>
              <p className="text-sm text-white/60 mb-7 max-w-[200px] leading-relaxed">QR kodu tara, uygulamayı indir ve ilk yemeğin bizden olsun.</p>
              <div className="bg-white p-3 rounded-xl shadow-lg mb-7 hover:scale-105 transition-transform duration-300">
                <img className="w-36 h-36 object-cover rounded-lg"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCC6Pgnq9IA4t6VMPuCMqdMfdTao_vjoM6-oRymUxPCygBliNdHDo0AhzyWFBDY1gSax6_pPl-W0LmCSQQeuDl1d49mRYkW5eKmC5SPOD3rujUO-a79vRjZGNMKwfFcRc8iPsWK4jJBFHuAR49qLICCJUHw570DKYE2yhW_XIVf2e5sYv1DEQzlwji-67Z4vZStI558EPyY7WakPJA8ZmSaEAajJf7lF_CG7rhMgJ7FuaoO1NHlBn_h1UHPF2TccaRr9R9gJTds9qs"
                  alt="QR Kod" />
              </div>
              <div className="flex gap-3 w-full">
                <button className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                  <span className="material-symbols-outlined text-[18px]">phone_iphone</span>iOS
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                  <span className="material-symbols-outlined text-[18px]">android</span>Android
                </button>
              </div>
            </div>

            {/* Sağ — Form */}
            <div className="flex-1 p-8 md:p-12 flex flex-col justify-center overflow-y-auto">
              <div className="mb-7">
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{authMode === 'login' ? 'Tekrar Hoş Geldin' : 'Hesap Oluştur'}</h3>
                <p className="text-sm text-gray-500">{authMode === 'login' ? 'Devam etmek için giriş yap.' : 'Ücretsiz kayıt ol, hemen sipariş ver.'}</p>
              </div>
              <div className="flex flex-col gap-3 mb-5">
                <div className="w-full flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleCredential}
                    onError={() => setAuthError('Google ile giriş iptal edildi veya hata oluştu.')}
                    text={authMode === 'login' ? 'signin_with' : 'signup_with'}
                    shape="pill"
                    width="320"
                  />
                </div>
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-3 bg-[#1877F2] opacity-50 cursor-not-allowed text-white py-3 px-4 rounded-full text-sm font-semibold shadow-sm"
                  title="Facebook girişi yakında eklenecek"
                >
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook ile devam et (Yakında)
                </button>
              </div>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-200" /><span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">veya</span><div className="flex-1 h-px bg-gray-200" />
              </div>
              <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
                {authMode === 'register' && (
                  <input required type="text" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Ad Soyad"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9a0002] focus:border-[#9a0002] outline-none transition-all text-gray-900 placeholder:text-gray-400" />
                )}
                <input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="E-posta adresi"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9a0002] focus:border-[#9a0002] outline-none transition-all text-gray-900 placeholder:text-gray-400" />
                <input required type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} placeholder="Şifre (en az 6 karakter, rakam içermeli)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9a0002] focus:border-[#9a0002] outline-none transition-all text-gray-900 placeholder:text-gray-400" />
                {authMode === 'register' && (
                  <select value={authRole} onChange={e => setAuthRole(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9a0002] focus:border-[#9a0002] outline-none transition-all text-gray-900">
                    <option value="customer">🛒 Müşteri</option>
                    <option value="courier">🛵 Kurye</option>
                    <option value="restaurant">🍽️ Restoran</option>
                  </select>
                )}
                {authMode === 'login' && (
                  <div className="flex justify-between items-center mt-1 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-[#9a0002] focus:ring-[#9a0002]" />
                      <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">Beni hatırla</span>
                    </label>
                    <button type="button" className="text-xs text-[#9a0002] font-semibold hover:underline">Şifremi unuttum</button>
                  </div>
                )}
                {authError && <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{authError}</div>}
                <button type="submit" disabled={authLoading} className="w-full bg-[#9a0002] hover:bg-[#7a0001] text-white py-3.5 rounded-full text-sm font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-60 mt-1">
                  {authLoading ? 'Lütfen bekleyin...' : authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
                </button>
              </form>
              {authMode === 'login' && (
                <div className="mt-4">
                  <button type="button" onClick={() => setShowTestAccts(v => !v)} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors py-1">
                    <span className="material-symbols-outlined text-[16px]">{showTestAccts ? 'expand_less' : 'expand_more'}</span>
                    {showTestAccts ? 'Test hesaplarını gizle' : 'Test hesaplarını görüntüle'}
                  </button>
                  {showTestAccts && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {TEST_ACCOUNTS.map(acc => (
                        <button key={acc.label} type="button" onClick={() => fillTest(acc)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-[#9a0002] hover:bg-red-50 transition-all text-left">
                          <span className="text-xl">{acc.icon}</span>
                          <div>
                            <p className="text-xs font-bold text-gray-800 leading-tight">{acc.label}</p>
                            <p className="text-[10px] text-gray-400">{acc.sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-center text-sm text-gray-500 mt-4">
                {authMode === 'login' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
                <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); setShowTestAccts(false) }} className="text-[#9a0002] font-semibold hover:underline">
                  {authMode === 'login' ? 'Kayıt Ol' : 'Giriş Yap'}
                </button>
              </p>
              <button type="button" onClick={closeAuth} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors mt-2 py-1">
                Kayıt olmadan devam et
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dropIn  { from{opacity:0;transform:translateY(-8px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes scaleUp { from{opacity:0;transform:scale(0.95) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  )
}
