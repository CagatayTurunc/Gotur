import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAddress, type SavedAddress } from '../context/AddressContext'

/* ── Nominatim reverse geocoding ── */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr`,
      { headers: { 'Accept-Language': 'tr' } }
    )
    const data = await res.json()
    if (data.address) {
      const a = data.address
      const parts = [
        a.road ?? a.pedestrian,
        a.neighbourhood ?? a.suburb,
        a.district ?? a.county,
        a.city ?? a.town ?? a.village,
      ].filter(Boolean)
      return parts.length ? parts.join(', ') : data.display_name
    }
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

/* ── Nominatim forward search ── */
interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    road?: string; pedestrian?: string; neighbourhood?: string; suburb?: string
    district?: string; county?: string; city?: string; town?: string; village?: string
  }
}

async function searchAddress(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) return []
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=tr&countrycodes=tr`,
      { headers: { 'Accept-Language': 'tr' } }
    )
    return res.json()
  } catch {
    return []
  }
}

const LABELS = ['Ev', 'İş', 'Diğer']

export default function AddressPickerModal() {
  const {
    isPickerOpen, closePicker,
    savedAddresses, selectedAddress,
    setSelectedAddress, addAddress, removeAddress,
  } = useAddress()

  const [step, setStep]             = useState<'list' | 'new'>('list')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError]     = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [searching, setSearching]   = useState(false)
  const [pickedLat, setPickedLat]   = useState<number | null>(null)
  const [pickedLng, setPickedLng]   = useState<number | null>(null)
  const [pickedText, setPickedText] = useState('')
  const [label, setLabel]           = useState('Ev')
  const [detail, setDetail]         = useState('')
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isPickerOpen) { setStep('list'); reset() }
  }, [isPickerOpen])

  // ESC tuşu ile kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePicker() }
    if (isPickerOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPickerOpen, closePicker])

  const reset = () => {
    setSearchQuery(''); setSuggestions([])
    setPickedLat(null); setPickedLng(null); setPickedText('')
    setLabel('Ev'); setDetail(''); setGpsError('')
  }

  const handleGps = useCallback(() => {
    if (!navigator.geolocation) { setGpsError('Tarayıcınız konum özelliğini desteklemiyor.'); return }
    setGpsLoading(true); setGpsError('')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const text = await reverseGeocode(lat, lng)
        setPickedLat(lat); setPickedLng(lng); setPickedText(text); setSearchQuery(text)
        setSuggestions([]); setGpsLoading(false); setStep('new')
      },
      err => {
        setGpsLoading(false)
        setGpsError(err.code === 1
          ? 'Konum izni reddedildi. Tarayıcı adres çubuğundaki kilit ikonundan izin verin.'
          : 'Konum alınamadı. Lütfen manuel arama yapın.'
        )
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    )
  }, [])

  const handleSearch = (val: string) => {
    setSearchQuery(val); setPickedLat(null); setPickedLng(null); setPickedText('')
    if (debounce.current) clearTimeout(debounce.current)
    if (!val.trim()) { setSuggestions([]); return }
    setSearching(true)
    debounce.current = setTimeout(async () => {
      setSuggestions(await searchAddress(val))
      setSearching(false)
    }, 500)
  }

  const pickSuggestion = (r: NominatimResult) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon)
    const a = r.address
    const parts = [a.road ?? a.pedestrian, a.neighbourhood ?? a.suburb, a.district ?? a.county, a.city ?? a.town ?? a.village].filter(Boolean)
    const text = parts.join(', ') || r.display_name
    setPickedLat(lat); setPickedLng(lng); setPickedText(text); setSearchQuery(text)
    setSuggestions([]); setStep('new')
  }

  const handleSave = () => {
    if (!pickedLat || !pickedLng || !pickedText) return
    const fullAddress = detail.trim() ? `${pickedText}, ${detail.trim()}` : pickedText
    addAddress({ label, fullAddress, lat: pickedLat, lng: pickedLng })
    closePicker()
  }

  const handleSelect = (addr: SavedAddress) => {
    setSelectedAddress(addr); closePicker()
  }

  if (!isPickerOpen) return null

  /* ── styles ── */
  const P  = { color: 'var(--text-primary)' }
  const S  = { color: 'var(--text-secondary)' }
  const A  = { color: 'var(--accent)' }
  const INPUT = { backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }

  const modal = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={closePicker}
      />

      {/* Sheet — bottom on mobile, centered on desktop */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        backgroundColor: 'var(--bg-page)',
        borderRadius: '20px 20px 0 0',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}
        /* prevent backdrop click from closing when clicking inside */
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, backgroundColor: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step === 'new' && (
              <button onClick={() => { setStep('list'); reset() }}
                style={{ ...S, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
              </button>
            )}
            <h2 style={{ ...P, margin: 0, fontWeight: 900, fontSize: 16 }}>
              {step === 'list' ? 'Teslimat Adresi' : 'Yeni Adres Ekle'}
            </h2>
          </div>
          <button onClick={closePicker}
            style={{ ...S, background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 999 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── LIST VIEW ── */}
          {step === 'list' && (<>

            {/* GPS Butonu */}
            <button onClick={handleGps} disabled={gpsLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, border: '1.5px solid var(--accent)', backgroundColor: 'var(--accent-soft)', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              {gpsLoading
                ? <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                : <span className="material-symbols-outlined" style={{ ...A, fontSize: 24, flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>my_location</span>
              }
              <div>
                <p style={{ ...A, fontWeight: 700, fontSize: 14, margin: 0 }}>
                  {gpsLoading ? 'Konum alınıyor...' : 'Mevcut Konumumu Kullan'}
                </p>
                <p style={{ ...S, fontSize: 12, margin: '2px 0 0' }}>GPS ile otomatik tespit</p>
              </div>
            </button>

            {gpsError && (
              <p style={{ color: '#e53e3e', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                {gpsError}
              </p>
            )}

            {/* Manuel Arama */}
            <button onClick={() => setStep('new')}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              <span className="material-symbols-outlined" style={{ ...S, fontSize: 24, flexShrink: 0 }}>search</span>
              <p style={{ ...P, fontWeight: 600, fontSize: 14, margin: 0 }}>Adres Ara veya Manuel Gir</p>
            </button>

            {/* Kayıtlı Adresler */}
            {savedAddresses.length > 0 && (
              <div>
                <p style={{ ...S, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '4px 0 8px' }}>Kayıtlı Adreslerim</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {savedAddresses.map(addr => {
                    const isSelected = selectedAddress?.id === addr.id
                    return (
                      <div key={addr.id}
                        onClick={() => handleSelect(addr)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-card)', cursor: 'pointer' }}>
                        <span className="material-symbols-outlined"
                          style={{ ...(isSelected ? A : S), fontSize: 22, flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>
                          {addr.label === 'Ev' ? 'home' : addr.label === 'İş' ? 'business' : 'location_on'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ ...P, fontWeight: 700, fontSize: 14, margin: 0 }}>{addr.label}</p>
                          <p style={{ ...S, fontSize: 12, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr.fullAddress}</p>
                        </div>
                        {isSelected && <span className="material-symbols-outlined" style={{ ...A, fontSize: 20, fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                        <button onClick={e => { e.stopPropagation(); removeAddress(addr.id) }}
                          style={{ ...S, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>)}

          {/* ── NEW ADDRESS VIEW ── */}
          {step === 'new' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* GPS */}
              <button onClick={handleGps} disabled={gpsLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: '1.5px solid var(--accent)', backgroundColor: 'var(--accent-soft)', cursor: 'pointer', width: '100%' }}>
                {gpsLoading
                  ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  : <span className="material-symbols-outlined" style={{ ...A, fontSize: 18, flexShrink: 0 }}>my_location</span>
                }
                <span style={{ ...A, fontWeight: 600, fontSize: 13 }}>
                  {gpsLoading ? 'Konum alınıyor...' : 'GPS ile Konumumu Kullan'}
                </span>
              </button>

              {gpsError && (
                <p style={{ color: '#e53e3e', fontSize: 12, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>warning</span>{gpsError}
                </p>
              )}

              {/* Arama inputu */}
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ ...S, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 20 }}>search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Mahalle, cadde veya adres ara..."
                  autoFocus
                  style={{ ...INPUT, width: '100%', padding: '12px 44px 12px 42px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
                {searching && (
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                )}
              </div>

              {/* Arama önerileri */}
              {suggestions.length > 0 && (
                <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
                  {suggestions.map((r, i) => (
                    <button key={r.place_id}
                      onClick={() => pickSuggestion(r)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                      <span className="material-symbols-outlined" style={{ ...S, fontSize: 18, flexShrink: 0, marginTop: 2 }}>location_on</span>
                      <p style={{ ...P, fontSize: 13, margin: 0, lineHeight: 1.4 }}>{r.display_name}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Seçilen konum */}
              {pickedText && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--accent)', backgroundColor: 'var(--accent-soft)' }}>
                  <span className="material-symbols-outlined" style={{ ...A, fontSize: 20, flexShrink: 0, fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  <div>
                    <p style={{ ...A, fontWeight: 600, fontSize: 14, margin: 0 }}>{pickedText}</p>
                    <p style={{ ...S, fontSize: 11, margin: '3px 0 0' }}>{pickedLat?.toFixed(5)}, {pickedLng?.toFixed(5)}</p>
                  </div>
                </div>
              )}

              {/* Daire/kat */}
              {pickedText && (
                <>
                  <input
                    type="text"
                    value={detail}
                    onChange={e => setDetail(e.target.value)}
                    placeholder="Daire no, kat, kapı kodu (opsiyonel)"
                    style={{ ...INPUT, width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />

                  {/* Etiket */}
                  <div>
                    <p style={{ ...S, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Adres Etiketi</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {LABELS.map(l => (
                        <button key={l} onClick={() => setLabel(l)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${label === l ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: label === l ? 'var(--accent-soft)' : 'var(--bg-card)', color: label === l ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            {l === 'Ev' ? 'home' : l === 'İş' ? 'business' : 'location_on'}
                          </span>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer — Kaydet butonu */}
        {step === 'new' && pickedText && (
          <div style={{ padding: '12px 20px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={handleSave}
              style={{ width: '100%', padding: '14px', borderRadius: 14, backgroundColor: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' }}>
              Bu Adresi Kaydet ve Seç
            </button>
          </div>
        )}
      </div>

      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return createPortal(modal, document.body)
}
