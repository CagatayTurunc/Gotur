// ── Kart yardımcı fonksiyonları ───────────────────────────────────────────────

export interface SavedCard {
  id: string
  last4: string
  brand: 'visa' | 'mastercard' | 'troy' | 'unknown'
  expiry: string        // "MM / YY"
  holderName: string
  maskedNumber: string  // "**** **** **** 1234"
}

// Luhn algoritması
export function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '')
  if (digits.length < 13) return false
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10)
    if (alt) { n *= 2; if (n > 9) n -= 9 }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

// Kart markası tespiti
export function detectBrand(num: string): SavedCard['brand'] {
  const d = num.replace(/\D/g, '')
  if (/^4/.test(d)) return 'visa'
  if (/^5[1-5]|^2[2-7]/.test(d)) return 'mastercard'
  if (/^9792/.test(d)) return 'troy'
  return 'unknown'
}

// Son kullanma tarihi geçerli mi?
export function isExpValid(exp: string): boolean {
  const clean = exp.replace(/\D/g, '')
  if (clean.length < 4) return false
  const month = parseInt(clean.slice(0, 2), 10)
  const year  = parseInt('20' + clean.slice(2, 4), 10)
  if (month < 1 || month > 12) return false
  const now = new Date()
  const expDate = new Date(year, month) // ilk günü = o ayın sonu
  return expDate > now
}

// Kart numarasını formatla: 4444 4444 4444 4444
export function formatCardNumber(val: string): string {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

// Son kullanma tarihini formatla: MM / YY
export function formatExpiry(val: string): string {
  const d = val.replace(/\D/g, '').slice(0, 4)
  if (d.length >= 3) return d.slice(0, 2) + ' / ' + d.slice(2)
  return d
}

// Maskelenmiş kart numarası
export function maskCardNumber(num: string): string {
  const d = num.replace(/\D/g, '').padEnd(16, '0')
  return `**** **** **** ${d.slice(-4)}`
}

// localStorage anahtarı
const STORAGE_KEY = 'gotur_saved_cards'

export function getSavedCards(userId: string): SavedCard[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`)
    return raw ? (JSON.parse(raw) as SavedCard[]) : []
  } catch {
    return []
  }
}

export function saveCard(userId: string, card: Omit<SavedCard, 'id'>): SavedCard {
  const cards = getSavedCards(userId)
  // Aynı son 4 hane varsa güncelle
  const existing = cards.findIndex(c => c.last4 === card.last4 && c.brand === card.brand)
  const newCard: SavedCard = { ...card, id: existing >= 0 ? cards[existing].id : crypto.randomUUID() }
  if (existing >= 0) cards[existing] = newCard
  else cards.push(newCard)
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(cards))
  return newCard
}

export function deleteCard(userId: string, cardId: string): void {
  const cards = getSavedCards(userId).filter(c => c.id !== cardId)
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(cards))
}
