import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { authService } from '../services/authService'
import { restaurantService, type MenuItem } from '../services/restaurantService'
import ThemeToggle from '../components/ThemeToggle'
import api from '../services/api'
import type { Restaurant } from '../types'

interface CartItem { id: string; name: string; price: number; qty: number; imageUrl?: string }

// ── Style shorthands ───────────────────────────────────────────────────────────
const accentStyle  = { color: 'var(--accent)' }
const primaryStyle = { color: 'var(--text-primary)' }
const secondaryStyle = { color: 'var(--text-secondary)' }
const cardStyle = { backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }

// ── Yıldız satırı ──────────────────────────────────────────────────────────────
function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" style={accentStyle}>
      {[1,2,3,4,5].map(s => (
        <span key={s} className="material-symbols-outlined text-[14px]"
          style={{ fontVariationSettings: rating >= s ? "'FILL' 1" : rating >= s-0.5 ? "'FILL' 0.5" : "'FILL' 0" }}>
          star
        </span>
      ))}
    </div>
  )
}

// ── Placeholder resim ─────────────────────────────────────────────────────────
const PLACEHOLDER = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop'

// ── Mock restoran tanımları (state'e gerek kalmadan) ─────────────────────────
const MOCK_RESTAURANTS_DATA: Record<string, { name: string; address: string; description: string; logoUrl: string }> = {
  'mock-1': { name: 'Çağdaş Pide Kebap Salonu', address: 'Atakent Mah. Şht. Celal İşen Sk. No:2, Etimesgut', description: 'Etimesgut\'un vazgeçilmez pide ve kebap durağı. Odun ateşinde kavurmalı pide.', logoUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop' },
  'mock-2': { name: 'Annem Elvan Sofrası', address: 'Elvan Mah. Ahi Elvan Cd. No:2/C, Etimesgut', description: 'Ev sıcaklığında günlük yemekler. Taze hazırlanan tabldot ve ev yemekleri.', logoUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop' },
  'mock-3': { name: 'Meşhur Ciğerci İdris Usta', address: 'Elvan Mah. Ahi Elvan Cd. No:34/B, Etimesgut', description: 'Etimesgut\'un efsane ciğercisi. Taze dana ciğeri ve el yapımı köfte.', logoUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop' },
  'mock-4': { name: 'Hocam Piknik', address: 'Piyade Mah. İstasyon Cad. No:215, Etimesgut', description: 'Etimesgut\'un gözde mangal restoranı. Közde taze etler, bahçede yemek keyfi.', logoUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop' },
  'mock-5': { name: 'Çağdaş Pide Kebap - Atakent', address: 'Atakent, 1478. Cad. No:1, Etimesgut', description: 'Geleneksel Türk mutfağından seçme kebap ve pide çeşitleri.', logoUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=400&fit=crop' },
  'mock-6': { name: 'Bolu Akın Lokantası', address: 'Kızılay, Çankaya, Ankara', description: 'Bolu usulü geleneksel Türk yemekleri. Kuzu incik, pilav ve mevsim tatlıları.', logoUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop' },
  'mock-7': { name: 'Mezzaluna Bilkent', address: 'Bilkent, Çankaya, Ankara', description: 'Ankara\'nın en iyi İtalyan mutfağı. Taze makarna ve ahşap fırında pizza.', logoUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=400&fit=crop' },
  'mock-8': { name: 'Uludağ İskender Ankara', address: 'Bahçelievler, Çankaya, Ankara', description: 'Bursa usulü gerçek İskender kebabı, tereyağı ve domates sosuyla.', logoUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=400&fit=crop' },
}

// ── Mock menü verisi (mock restoranlar için) ──────────────────────────────────
const MOCK_MENUS: Record<string, MenuItem[]> = {
  'mock-1': [
    { id: 'm1-1', name: 'Kavurmalı Pide', description: 'Dana kavurma dolgulu, odun fırınında pişmiş', price: 185, category: 'Pide', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 0, restaurantId: 'mock-1' },
    { id: 'm1-2', name: 'Kıymalı Pide', description: 'Kıyma ve soğan harcı, fırında pişmiş', price: 165, category: 'Pide', imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 1, restaurantId: 'mock-1' },
    { id: 'm1-3', name: 'Kaşarlı Pide', description: 'Bol erimiş kaşar peynirli', price: 155, category: 'Pide', imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 2, restaurantId: 'mock-1' },
    { id: 'm1-4', name: 'Adana Kebap', description: '200g acılı kıyma kebap, lavaş ve söğüş', price: 195, category: 'Kebap', imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 3, restaurantId: 'mock-1' },
    { id: 'm1-5', name: 'Karışık Izgara', description: 'Adana, şiş, kanat, köfte tabağı', price: 285, category: 'Izgara', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 4, restaurantId: 'mock-1' },
    { id: 'm1-6', name: 'Mercimek Çorbası', description: 'Günlük taze mercimek çorbası', price: 55, category: 'Çorba', imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 5, restaurantId: 'mock-1' },
    { id: 'm1-7', name: 'Ayran', description: 'Soğuk ev yapımı ayran 400ml', price: 25, category: 'İçecek', imageUrl: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 6, restaurantId: 'mock-1' },
  ],
  'mock-2': [
    { id: 'm2-1', name: 'Günlük Tabldot', description: '2 çeşit yemek, pilav veya makarna, çorba, ekmek', price: 175, category: 'Tabldot', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 0, restaurantId: 'mock-2' },
    { id: 'm2-2', name: 'Kuru Fasulye + Pilav', description: 'Ev yapımı kuru fasulye, pirinç pilav', price: 110, category: 'Yemek', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 1, restaurantId: 'mock-2' },
    { id: 'm2-3', name: 'İzmir Köfte', description: 'Patatesli soslu köfte, ekmek', price: 145, category: 'Yemek', imageUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 2, restaurantId: 'mock-2' },
    { id: 'm2-4', name: 'Mercimek Çorbası', description: 'Günlük taze mercimek çorbası', price: 55, category: 'Çorba', imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 3, restaurantId: 'mock-2' },
    { id: 'm2-5', name: 'Sütlaç', description: 'Fırın sütlaç, üstü kızarmış', price: 70, category: 'Tatlı', imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 4, restaurantId: 'mock-2' },
    { id: 'm2-6', name: 'Ayran', description: 'Soğuk ayran', price: 25, category: 'İçecek', imageUrl: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 5, restaurantId: 'mock-2' },
  ],
  'mock-3': [
    { id: 'm3-1', name: 'Dana Ciğer Tava', description: 'Taze dana ciğeri, soğan, biber ile', price: 155, category: 'Ciğer', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 0, restaurantId: 'mock-3' },
    { id: 'm3-2', name: 'Ciğer Dürüm', description: 'Lavaşta ciğer, maydanoz, acı biber', price: 99, category: 'Dürüm', imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 1, restaurantId: 'mock-3' },
    { id: 'm3-3', name: 'El Yapımı Köfte', description: '6 adet el yapımı dana köfte, ekmek, söğüş', price: 160, category: 'Köfte', imageUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 2, restaurantId: 'mock-3' },
    { id: 'm3-4', name: 'Köfte Dürüm', description: 'İnce lavaşta köfte, sos ve söğüş', price: 110, category: 'Dürüm', imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 3, restaurantId: 'mock-3' },
    { id: 'm3-5', name: 'Piyaz', description: 'Haşlanmış fasulye, soğan, maydanoz salatası', price: 50, category: 'Meze', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 4, restaurantId: 'mock-3' },
    { id: 'm3-6', name: 'Ayran', description: 'Soğuk ev yapımı ayran', price: 25, category: 'İçecek', imageUrl: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 5, restaurantId: 'mock-3' },
  ],
  'mock-4': [
    { id: 'm4-1', name: 'Karışık Mangal Tabağı', description: 'Adana, şiş, kanat, sucuk ve pilav', price: 295, category: 'Mangal', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 0, restaurantId: 'mock-4' },
    { id: 'm4-2', name: 'Kuzu Şiş', description: 'Marine edilmiş kuzu but şiş, közde pişmiş', price: 245, category: 'Kebap', imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 1, restaurantId: 'mock-4' },
    { id: 'm4-3', name: 'Tavuk Şiş', description: 'Marine edilmiş tavuk göğsü şiş', price: 185, category: 'Kebap', imageUrl: 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 2, restaurantId: 'mock-4' },
    { id: 'm4-4', name: 'Sucuk Izgara', description: 'Geleneksel Türk sucuğu, közde pişmiş', price: 155, category: 'Izgara', imageUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 3, restaurantId: 'mock-4' },
    { id: 'm4-5', name: 'Çoban Salata', description: 'Domates, salatalık, biber, soğan, zeytinyağı', price: 65, category: 'Salata', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 4, restaurantId: 'mock-4' },
    { id: 'm4-6', name: 'Ayran', description: 'Soğuk ev yapımı ayran 400ml', price: 25, category: 'İçecek', imageUrl: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 5, restaurantId: 'mock-4' },
  ],
  'mock-5': [
    { id: 'm5-1', name: 'Kavurmalı Pide', description: 'Dana kavurma dolgulu pide', price: 185, category: 'Pide', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 0, restaurantId: 'mock-5' },
    { id: 'm5-2', name: 'Adana Kebap', description: 'Acılı kıyma kebap, lavaş ile', price: 195, category: 'Kebap', imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 1, restaurantId: 'mock-5' },
    { id: 'm5-3', name: 'Mercimek Çorbası', description: 'Taze günlük çorba', price: 55, category: 'Çorba', imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 2, restaurantId: 'mock-5' },
    { id: 'm5-4', name: 'Ayran', description: 'Soğuk ayran', price: 25, category: 'İçecek', imageUrl: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop', isAvailable: true, sortOrder: 3, restaurantId: 'mock-5' },
  ],
}

const REVIEWS = [
  { stars: 4.5, text: 'Yemekler inanılmaz lezzetliydi. Teslimat da oldukça hızlıydı, kesinlikle tekrar sipariş vereceğim.', badge: 'Deneyimli Yorumcu', date: '2 hafta önce' },
  { stars: 5,   text: 'Her şey mükemmeldi! Sıcak, taze ve çok lezzetli. Teşekkürler.', badge: 'Gurme', date: '1 ay önce' },
  { stars: 4,   text: 'Porsiyonlar doyurucu ve fiyatlar makul. Genel olarak çok iyi bir deneyimdi.', badge: 'Yeni Üye', date: '2 ay önce' },
]

export default function RestaurantDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const user = authService.getUser()

  // ── Veri state'leri ──────────────────────────────────────────────────────────
  const [restaurant, setRestaurant]     = useState<Restaurant | null>(null)
  const [menuItems,  setMenuItems]      = useState<MenuItem[]>([])
  const [loading,    setLoading]        = useState(true)
  const [menuSearch, setMenuSearch]     = useState('')

  // ── Sepet ─────────────────────────────────────────────────────────────────────
  const [cart,       setCart]       = useState<CartItem[]>([])
  const [pickupMode, setPickupMode] = useState(false)

  // ── Kategori navbar ──────────────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string>('')
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})

  // ── Favori ───────────────────────────────────────────────────────────────────
  const [isFav, setIsFav] = useState(false)

  // ── API çağrıları ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    setLoading(true)

    // Mock restoran ise MOCK_RESTAURANTS_DATA'dan oku, API'ye gitme
    if (id.startsWith('mock')) {
      const mockData = MOCK_RESTAURANTS_DATA[id]
      const mockRest: Restaurant | null = mockData
        ? { id, name: mockData.name, address: mockData.address, description: mockData.description, logoUrl: mockData.logoUrl, isOpen: true, locationLat: 0, locationLng: 0 }
        : null
      const items = MOCK_MENUS[id] ?? []
      setRestaurant(mockRest)
      setMenuItems(items)
      const firstCat = items.find(i => i.category)?.category ?? ''
      setActiveCategory(firstCat)
      setLoading(false)
      return
    }

    Promise.all([
      api.get<Restaurant[]>('/restaurants'),
      restaurantService.getMenuItems(id),
    ]).then(([restsRes, items]) => {
      const found = restsRes.data.find(r => r.id === id) ?? restsRes.data[0] ?? null
      setRestaurant(found)
      setMenuItems(items)
      const firstCat = items.find(i => i.category)?.category ?? ''
      setActiveCategory(firstCat)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Kategori hesapla ──────────────────────────────────────────────────────────
  const categories = Array.from(new Set(menuItems.map(m => m.category ?? 'Diğer')))

  // ── Arama filtresi ────────────────────────────────────────────────────────────
  const filteredItems = menuSearch.trim()
    ? menuItems.filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase()) || (m.description ?? '').toLowerCase().includes(menuSearch.toLowerCase()))
    : menuItems

  const grouped = categories.reduce<Record<string, MenuItem[]>>((acc, cat) => {
    acc[cat] = filteredItems.filter(m => (m.category ?? 'Diğer') === cat)
    return acc
  }, {})

  // ── Sepet işlemleri ───────────────────────────────────────────────────────────
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === item.id)
      if (idx >= 0) return prev.map((it, i) => i === idx ? { ...it, qty: it.qty + 1 } : it)
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, imageUrl: item.imageUrl }]
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === itemId)
      if (idx < 0) return prev
      if (prev[idx].qty <= 1) return prev.filter((_, i) => i !== idx)
      return prev.map((it, i) => i === idx ? { ...it, qty: it.qty - 1 } : it)
    })
  }

  const cartQty = (itemId: string) => cart.find(i => i.id === itemId)?.qty ?? 0
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  // ── Checkout ──────────────────────────────────────────────────────────────────
  const handleCheckout = () => {
    if (!user) {
      navigate('/login', { state: { returnTo: `/restaurants/${id}` } })
      return
    }
    navigate('/checkout', {
      state: {
        items: cart.map(i => ({ name: i.name, quantity: i.qty, price: i.price })),
        restaurantId: id,
      }
    })
  }

  const handleLogout = () => { authService.logout(); navigate('/login') }

  // ── Kategori scroll ───────────────────────────────────────────────────────────
  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat)
    categoryRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-page)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <p className="text-sm font-medium" style={secondaryStyle}>Menü yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen font-sans antialiased transition-colors"
      style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}>

      {/* ── HEADER ── */}
      <header className="border-b sticky top-0 z-50 shadow-sm transition-colors"
        style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-[1280px] mx-auto px-4 md:px-12 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/')} className="text-2xl font-black italic tracking-tight transition-opacity hover:opacity-70" style={accentStyle}>
              Götür
            </button>
            <div className="hidden md:flex items-center rounded-full px-4 py-2 max-w-xs" style={{ backgroundColor: 'var(--bg-muted)' }}>
              <span className="material-symbols-outlined mr-2 text-[20px]" style={secondaryStyle}>search</span>
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none"
                style={primaryStyle}
                placeholder="Menüde Ara"
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
              />
              {menuSearch && (
                <button onClick={() => setMenuSearch('')} style={secondaryStyle}>
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden md:block text-sm font-medium" style={secondaryStyle}>{user.fullName}</span>
                <button onClick={handleLogout} className="text-sm font-semibold px-4 py-2 rounded-full border hover:opacity-70 transition-opacity"
                  style={{ ...secondaryStyle, borderColor: 'var(--border)' }}>Çıkış</button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="text-sm font-semibold px-4 py-2 rounded-full hover:opacity-70 transition-opacity" style={secondaryStyle}>Giriş Yap</button>
                <button onClick={() => navigate('/login')} className="text-sm font-semibold text-white px-4 py-2 rounded-full hover:opacity-80 transition-opacity" style={{ backgroundColor: 'var(--accent)' }}>Kayıt Ol</button>
              </>
            )}
            <ThemeToggle />
            {cartCount > 0 && (
              <button className="relative p-2 hover:opacity-70 transition-opacity" style={secondaryStyle}>
                <span className="material-symbols-outlined">shopping_bag</span>
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>{cartCount}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <main className="max-w-[1280px] mx-auto px-4 md:px-12 py-6 grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* ── LEFT CONTENT ── */}
        <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-8">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-xs" style={secondaryStyle}>
            <button onClick={() => navigate('/')} className="hover:opacity-70 hover:underline transition-opacity">Anasayfa</button>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="hover:opacity-70 hover:underline cursor-pointer transition-opacity">Restoranlar</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="font-semibold" style={primaryStyle}>{restaurant?.name ?? 'Restoran'}</span>
          </nav>

          {/* Restoran Hero Kartı */}
          <section className="rounded-xl p-4 md:p-5 flex flex-col md:flex-row gap-5 shadow-sm border" style={cardStyle}>
            <img
              src={restaurant?.logoUrl || PLACEHOLDER}
              alt={restaurant?.name}
              className="w-full md:w-44 h-44 object-cover rounded-xl shrink-0"
              onError={e => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER }}
            />
            <div className="flex flex-col justify-between w-full">
              <div>
                <p className="text-xs mb-1" style={secondaryStyle}>
                  {categories.slice(0, 3).join(' · ')}
                </p>
                <div className="flex items-start justify-between w-full">
                  <h1 className="text-2xl md:text-3xl font-black" style={primaryStyle}>{restaurant?.name ?? 'Restoran'}</h1>
                  <button
                    onClick={() => setIsFav(v => !v)}
                    className="flex items-center gap-1.5 border rounded-full px-3 py-1.5 hover:opacity-70 transition-opacity text-sm font-semibold shrink-0"
                    style={{ ...secondaryStyle, borderColor: 'var(--border)' }}>
                    <span className="material-symbols-outlined text-[16px]" style={isFav ? { ...accentStyle, fontVariationSettings: "'FILL' 1" } : {}}>
                      {isFav ? 'favorite' : 'favorite_border'}
                    </span>
                    {isFav ? 'Favorilerde' : 'Favorilere Ekle'}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-primary)' }}>
                    <span className="material-symbols-outlined text-[13px]" style={accentStyle}>star</span>
                    <span className="font-bold">4.5</span>
                    <span style={secondaryStyle}>(1000+)</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={secondaryStyle}>
                    <span className="material-symbols-outlined text-[15px]">schedule</span>25-35 dk
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={secondaryStyle}>
                    <span className="material-symbols-outlined text-[15px]">shopping_basket</span>Min. 150 ₺
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={secondaryStyle}>
                    <span className="material-symbols-outlined text-[15px]">local_shipping</span>
                    {total >= 300 ? 'Ücretsiz Teslimat' : '29,90 ₺ teslimat'}
                  </div>
                  {menuItems.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                      <span className="material-symbols-outlined text-[13px]">restaurant_menu</span>
                      {menuItems.length} ürün
                    </div>
                  )}
                </div>
                {restaurant?.address && (
                  <p className="text-xs mt-2 flex items-center gap-1" style={secondaryStyle}>
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    {restaurant.address}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* 300₺ üzeri ücretsiz teslimat banner */}
          {total > 0 && total < 300 && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3 border"
              style={{ backgroundColor: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
              <span className="material-symbols-outlined text-[20px]" style={accentStyle}>local_shipping</span>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={accentStyle}>
                  Ücretsiz teslimat için {(300 - total).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ daha ekle
                </p>
                <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-muted)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((total/300)*100, 100)}%`, backgroundColor: 'var(--accent)' }} />
                </div>
              </div>
            </div>
          )}
          {total >= 300 && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-green-200 bg-green-50">
              <span className="material-symbols-outlined text-[20px] text-green-600">check_circle</span>
              <p className="text-sm font-semibold text-green-700">Ücretsiz teslimat kazandınız! 🎉</p>
            </div>
          )}

          {/* Mobil arama */}
          <div className="flex md:hidden items-center rounded-full px-4 py-2.5 border" style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
            <span className="material-symbols-outlined mr-2 text-[20px]" style={secondaryStyle}>search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none"
              style={primaryStyle}
              placeholder="Menüde Ara"
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
            />
            {menuSearch && (
              <button onClick={() => setMenuSearch('')} style={secondaryStyle}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Kategori Nav */}
          {categories.length > 0 && !menuSearch && (
            <div className="sticky top-[57px] z-40 py-2 border-b -mx-4 px-4 md:mx-0 md:px-0 transition-colors"
              style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map(cat => (
                  <button key={cat} onClick={() => scrollToCategory(cat)}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all ${activeCategory === cat ? 'text-white shadow-sm' : 'hover:opacity-70'}`}
                    style={activeCategory === cat ? { backgroundColor: 'var(--accent)' } : { color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                    {cat} ({(grouped[cat] ?? []).length})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Menü yok durumu */}
          {menuItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="material-symbols-outlined text-[56px] mb-4 opacity-20" style={primaryStyle}>restaurant_menu</span>
              <h3 className="text-lg font-bold mb-1" style={primaryStyle}>Menü henüz eklenmemiş</h3>
              <p className="text-sm" style={secondaryStyle}>Bu restoran henüz menüsünü paylaşmamış.</p>
            </div>
          )}

          {/* Arama sonucu yok */}
          {menuSearch && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-symbols-outlined text-[48px] mb-3 opacity-20" style={primaryStyle}>search_off</span>
              <h3 className="text-base font-bold mb-1" style={primaryStyle}>"{menuSearch}" bulunamadı</h3>
              <button onClick={() => setMenuSearch('')} className="text-sm font-semibold mt-2 hover:opacity-70" style={accentStyle}>Aramayı temizle</button>
            </div>
          )}

          {/* Menü Bölümleri */}
          {(menuSearch ? [{ cat: 'Arama Sonuçları', items: filteredItems }] : categories.map(cat => ({ cat, items: grouped[cat] ?? [] }))).map(({ cat, items }) => {
            if (items.length === 0) return null
            return (
              <section key={cat} ref={el => { categoryRefs.current[cat] = el }}>
                <h3 className="text-lg font-black mb-4" style={primaryStyle}>{cat}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map(item => {
                    const qty = cartQty(item.id)
                    return (
                      <div key={item.id} className={`rounded-xl p-4 flex gap-4 border hover:shadow-md transition-shadow group relative ${!item.isAvailable ? 'opacity-50' : 'cursor-pointer'}`} style={cardStyle}>
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            {!item.isAvailable && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 inline-block" style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                                Stokta Yok
                              </span>
                            )}
                            <h4 className="text-sm font-bold group-hover:opacity-70 transition-opacity" style={primaryStyle}>{item.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-base font-black" style={accentStyle}>
                                {item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs mt-1.5 line-clamp-2" style={secondaryStyle}>{item.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="relative shrink-0">
                          <img
                            src={item.imageUrl || PLACEHOLDER}
                            alt={item.name}
                            className="w-24 h-24 object-cover rounded-xl"
                            onError={e => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER }}
                          />
                          {item.isAvailable && (qty === 0 ? (
                            <button onClick={() => addToCart(item)}
                              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-sm border hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--accent)' }}>
                              <span className="material-symbols-outlined text-[20px]">add</span>
                            </button>
                          ) : (
                            <div className="absolute -bottom-2 -right-2 flex items-center gap-0.5 rounded-full shadow-sm px-1 border"
                              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                              <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 flex items-center justify-center rounded-full hover:opacity-70 transition-opacity" style={accentStyle}>
                                <span className="material-symbols-outlined text-[18px]">remove</span>
                              </button>
                              <span className="text-sm font-bold w-4 text-center" style={primaryStyle}>{qty}</span>
                              <button onClick={() => addToCart(item)} className="w-7 h-7 flex items-center justify-center rounded-full hover:opacity-70 transition-opacity" style={accentStyle}>
                                <span className="material-symbols-outlined text-[18px]">add</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {/* Yorumlar */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black" style={primaryStyle}>Müşteri Yorumları</h2>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[20px]" style={{ ...accentStyle, fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="font-bold" style={primaryStyle}>4.5</span>
                <span className="text-sm" style={secondaryStyle}>/ 5 (1000+)</span>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {REVIEWS.map((r, i) => (
                <div key={i} className="min-w-[300px] max-w-[300px] rounded-xl p-4 shadow-sm border flex flex-col gap-3" style={cardStyle}>
                  <div className="flex justify-between items-start">
                    <StarRow rating={r.stars} />
                    <span className="text-xs" style={secondaryStyle}>{r.date}</span>
                  </div>
                  <p className="text-sm line-clamp-3" style={primaryStyle}>{r.text}</p>
                  <div className="mt-auto pt-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                    <span className="material-symbols-outlined text-[20px]" style={secondaryStyle}>account_circle</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>{r.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── SAĞ SEPET ── */}
        <aside className="hidden md:block md:col-span-4 lg:col-span-3">
          <div className="sticky top-[73px] rounded-xl shadow-sm border overflow-hidden flex flex-col max-h-[calc(100vh-90px)]" style={cardStyle}>

            {/* Teslimat / Gel Al toggle */}
            <div className="p-3 border-b" style={{ backgroundColor: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => setPickupMode(false)}
                  className="flex-1 py-2 text-sm font-semibold text-center transition-colors"
                  style={!pickupMode ? { backgroundColor: 'var(--accent)', color: '#fff' } : { color: 'var(--text-secondary)' }}>
                  Teslimat
                </button>
                <button onClick={() => setPickupMode(true)}
                  className="flex-1 py-2 text-sm font-semibold text-center transition-colors"
                  style={pickupMode ? { backgroundColor: 'var(--accent)', color: '#fff' } : { color: 'var(--text-secondary)' }}>
                  Gel Al
                </button>
              </div>
            </div>

            {/* Sepet İçeriği */}
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center h-full py-10">
                  <span className="material-symbols-outlined text-[56px] mb-3" style={{ color: 'var(--accent)' }}>shopping_bag</span>
                  <h3 className="font-bold mb-1" style={primaryStyle}>İlk siparişte ücretsiz teslimat</h3>
                  <p className="text-sm" style={secondaryStyle}>300 ₺ üzeri siparişlerde teslimat ücretsiz.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'var(--bg-muted)' }}>
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      )}
                      <span className="text-sm font-medium flex-1 leading-tight" style={primaryStyle}>{item.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 rounded-full border flex items-center justify-center hover:opacity-70 transition-opacity"
                          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--accent)' }}>
                          <span className="material-symbols-outlined text-[14px]">remove</span>
                        </button>
                        <span className="w-5 text-center text-sm font-bold" style={primaryStyle}>{item.qty}</span>
                        <button onClick={() => { const m = menuItems.find(m => m.id === item.id); if(m) addToCart(m) }} className="w-6 h-6 rounded-full text-white flex items-center justify-center hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: 'var(--accent)' }}>
                          <span className="material-symbols-outlined text-[14px]">add</span>
                        </button>
                      </div>
                      <span className="text-sm font-bold w-16 text-right shrink-0" style={accentStyle}>
                        {(item.price * item.qty).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alt — toplam & CTA */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
              {cart.length > 0 && (
                <div className="space-y-1.5 mb-3 text-xs" style={secondaryStyle}>
                  <div className="flex justify-between">
                    <span>Ara toplam</span>
                    <span>{total.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Teslimat</span>
                    {total >= 300 ? (
                      <span className="font-semibold text-green-600">Ücretsiz</span>
                    ) : (
                      <span>29,90 ₺</span>
                    )}
                  </div>
                  <div className="h-px my-1" style={{ backgroundColor: 'var(--border)' }} />
                </div>
              )}
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold" style={primaryStyle}>Toplam <span className="text-xs font-normal" style={secondaryStyle}>(vergiler dahil)</span></span>
                <span className="text-lg font-black" style={primaryStyle}>
                  {(total + (cart.length > 0 && total < 300 ? 29.9 : 0)).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
                </span>
              </div>
              {cart.length > 0 ? (
                <button onClick={handleCheckout} className="w-full text-white font-black py-3 rounded-full transition-all shadow-md active:scale-[0.98] hover:opacity-90"
                  style={{ backgroundColor: 'var(--accent)' }}>
                  {user ? 'Siparişi Tamamla →' : 'Devam etmek için giriş yap →'}
                </button>
              ) : (
                <button disabled className="w-full font-semibold py-3 rounded-full cursor-not-allowed text-sm opacity-60"
                  style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                  Sepete ürün ekleyin
                </button>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* ── FOOTER ── */}
      <footer className="mt-16 pt-12 pb-24 md:pb-12" style={{ backgroundColor: 'var(--footer-bg)', color: 'var(--footer-text)' }}>
        <div className="max-w-[1280px] mx-auto px-4 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-4">
            <span className="text-2xl font-black italic" style={accentStyle}>Götür</span>
            <p className="text-sm opacity-70">İhtiyacın olan her şey, dakikalar içinde kapında.</p>
          </div>
          {[
            { title: 'Keşfet', links: ['Kategoriler', 'Popüler Restoranlar', 'Kampanyalar', 'Yeni Gelenler'] },
            { title: 'Yardım', links: ['Sıkça Sorulan Sorular', 'İletişim', 'Destek Merkezi', 'Geri Bildirim'] },
            { title: 'Kurumsal', links: ['Hakkımızda', 'Kariyer', 'Gizlilik Politikası', 'Kullanım Koşulları'] },
          ].map(col => (
            <div key={col.title} className="flex flex-col gap-2">
              <h4 className="font-bold mb-1">{col.title}</h4>
              {col.links.map(l => <a key={l} href="#" className="text-sm opacity-70 hover:opacity-100 transition-opacity">{l}</a>)}
            </div>
          ))}
        </div>
        <div className="max-w-[1280px] mx-auto px-4 md:px-12 mt-10 pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs opacity-50">© 2026 Götür. Tüm hakları saklıdır.</p>
          <div className="flex gap-3">
            <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors">
              <span className="material-symbols-outlined text-[18px]">phone_iphone</span>App Store
            </button>
            <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors">
              <span className="material-symbols-outlined text-[18px]">android</span>Google Play
            </button>
          </div>
        </div>
      </footer>

      {/* Mobil Sepet Çubuğu */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full md:hidden z-50 p-4 border-t shadow-lg"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <button onClick={handleCheckout} className="w-full text-white font-black py-3.5 rounded-full flex items-center justify-between px-5 shadow-md"
            style={{ backgroundColor: 'var(--accent)' }}>
            <span className="bg-white/20 text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center">{cartCount}</span>
            <span>{user ? 'Siparişi Tamamla' : 'Devam etmek için giriş yap'}</span>
            <span className="font-bold">{total.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
          </button>
        </div>
      )}

      {/* Mobil Bottom Nav */}
      {cart.length === 0 && (
        <nav className="fixed bottom-0 left-0 w-full h-16 flex justify-around items-center border-t px-4 md:hidden z-50 rounded-t-xl shadow-lg transition-colors"
          style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
          <button onClick={() => navigate('/')} className="flex flex-col items-center" style={secondaryStyle}>
            <span className="material-symbols-outlined">home</span>
            <span className="text-[10px]">Ana Sayfa</span>
          </button>
          <button className="flex flex-col items-center" style={accentStyle}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
            <span className="text-[10px] font-semibold">Ara</span>
          </button>
          <button onClick={() => user ? navigate('/orders') : navigate('/login')} className="flex flex-col items-center" style={secondaryStyle}>
            <span className="material-symbols-outlined">shopping_bag</span>
            <span className="text-[10px]">Siparişler</span>
          </button>
          <button onClick={() => user ? navigate('/account') : navigate('/login')} className="flex flex-col items-center" style={secondaryStyle}>
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px]">Profil</span>
          </button>
        </nav>
      )}
    </div>
  )
}
