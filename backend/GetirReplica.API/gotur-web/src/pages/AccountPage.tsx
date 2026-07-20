import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import WalletNavbar from '../components/WalletNavbar'
import { authService } from '../services/authService'
import api from '../services/api'
import { getSavedCards, deleteCard, type SavedCard } from '../utils/cardUtils'

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

const ROLE_LABEL: Record<string, string> = {
  customer: 'Müşteri',
  courier: 'Kurye',
  admin: 'Admin',
  restaurant: 'Restoran',
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (local.length <= 3) return `${local[0]}***@${domain}`
  return `${local.slice(0, 2)}${'*'.repeat(local.length - 3)}${local.slice(-1)}@${domain}`
}

export default function AccountPage() {
  const navigate = useNavigate()
  const user = authService.getUser()

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  // Notification prefs (local only)
  const [emailNotif, setEmailNotif] = useState(true)
  const [smsNotif, setSmsNotif] = useState(true)

  // Toast
  const [toastMsg, setToastMsg] = useState('')

  // Saved cards state
  const [savedCards, setSavedCards] = useState<SavedCard[]>(() => getSavedCards(user?.id ?? ''))

  if (!user) { navigate('/login'); return null }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (newPassword !== confirmPassword) {
      setPwError('Yeni şifreler eşleşmiyor.')
      return
    }
    if (newPassword.length < 8) {
      setPwError('Yeni şifre en az 8 karakter olmalıdır.')
      return
    }

    setPwLoading(true)
    try {
      await api.patch('/auth/password', { currentPassword, newPassword })
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showToast('Şifre başarıyla güncellendi.')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPwError(msg ?? 'Şifre değiştirilemedi. Mevcut şifrenizi kontrol edin.')
    } finally {
      setPwLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm verileriniz silinecektir.'
    )
    if (!confirmed) return

    try {
      await api.delete('/auth/me')
    } catch {
      // Sunucu hatası olsa bile token'ı temizle ve çıkış yap
    }
    authService.logout()
    navigate('/login')
  }

  const CARD_CLASS =
    'bg-white rounded-2xl p-5 md:p-6 shadow-[0_4px_12px_rgba(39,24,21,0.06)] border border-[#f0e0dd]'
  const INPUT_CLASS =
    'w-full px-4 py-3 rounded-xl border border-[#e4beb8] bg-[#fff8f6] text-[#271815] focus:outline-none focus:ring-2 focus:ring-[#9a0002]/20 focus:border-[#9a0002] transition text-sm'
  const BTN_PRIMARY =
    'bg-[#9a0002] hover:bg-[#6f0001] text-white font-bold rounded-full px-6 py-3 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="min-h-screen bg-[#fff8f6]">
      <WalletNavbar activePage="account" />

      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#9a0002] text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold animate-[toastIn_0.2s_ease-out]">
          <div className="flex items-center gap-2">
            <Icon name="check_circle" filled className="text-[18px]" />
            {toastMsg}
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 pb-28 space-y-6">

        {/* Page Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#271815]">Hesap Ayarları</h1>
          <p className="text-sm text-[#8f706b] mt-1">Kişisel bilgilerini ve güvenlik ayarlarını yönet.</p>
        </div>

        {/* ── 1. Profile Info Card ── */}
        <div className={CARD_CLASS}>
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-[#9a0002] flex items-center justify-center text-white text-2xl font-black flex-shrink-0">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-[#271815] leading-tight">{user.fullName}</h2>
              <p className="text-sm text-[#8f706b] mt-0.5 truncate">{user.email}</p>
              <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-[#9a0002] text-xs font-semibold">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. Contact Verification Card ── */}
        <div className={CARD_CLASS}>
          <h3 className="font-black text-[#271815] text-base mb-1">İletişim Bilgileri</h3>
          <p className="text-sm text-[#8f706b] mb-5">Sipariş güncellemeleri ve iletişim için bilgilerinizi doğrulayın.</p>

          <div className="space-y-3">
            {/* Email row */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#fff8f6] border border-[#f0e0dd]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#fff0ee] flex items-center justify-center flex-shrink-0">
                  <Icon name="email" className="text-[18px] text-[#9a0002]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#8f706b] font-semibold">E-posta</p>
                  <p className="text-sm font-semibold text-[#271815] truncate">{maskEmail(user.email)}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold flex-shrink-0 border border-green-200">
                <Icon name="check_circle" filled className="text-[13px]" />
                Doğrulandı
              </span>
            </div>

            {/* Phone row */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#fff8f6] border border-[#f0e0dd]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#fff0ee] flex items-center justify-center flex-shrink-0">
                  <Icon name="phone" className="text-[18px] text-[#9a0002]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#8f706b] font-semibold">Telefon</p>
                  <p className="text-sm font-semibold text-[#271815]">+90 5** *** ** **</p>
                </div>
              </div>
              <button className="px-3 py-1.5 rounded-full bg-[#9a0002] text-white text-xs font-bold hover:bg-[#6f0001] transition flex-shrink-0">
                Doğrula
              </button>
            </div>
          </div>
        </div>

        {/* ── 3. Kayıtlı Kartlar ── */}
        <div className={CARD_CLASS}>
          <h3 className="font-black text-[#271815] text-base mb-1">Kayıtlı Kartlarım</h3>
          <p className="text-sm text-[#8f706b] mb-5">Ödeme sayfasında kaydettiğiniz kartlar burada görünür.</p>
          {savedCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-xl" style={{ backgroundColor: '#fff8f6' }}>
              <Icon name="credit_card_off" className="text-[40px] text-[#e4beb8]" />
              <p className="text-sm text-[#8f706b]">Henüz kayıtlı kart yok.</p>
              <button onClick={() => navigate('/checkout')}
                className="mt-1 text-xs font-bold text-[#9a0002] hover:underline">
                Sipariş sırasında kart ekleyebilirsiniz →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedCards.map(card => (
                <div key={card.id} className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: '#f9dcd7', backgroundColor: '#fff8f6' }}>
                  <span className="material-symbols-outlined text-[28px]" style={{ color: '#9a0002' }}>credit_card</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#271815]">{card.maskedNumber}</p>
                    <p className="text-xs text-[#8f706b]">{card.holderName} · Son kullanma: {card.expiry} · {card.brand.charAt(0).toUpperCase() + card.brand.slice(1)}</p>
                  </div>
                  <button
                    onClick={() => {
                      deleteCard(user.id, card.id)
                      setSavedCards(getSavedCards(user.id))
                      showToast('Kart silindi.')
                    }}
                    className="p-2 rounded-full hover:bg-red-50 transition-colors text-[#c5221f]"
                    title="Kartı sil">
                    <Icon name="delete" className="text-[18px]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 4. Password Change Card ── */}
        <div className={CARD_CLASS}>
          <h3 className="font-black text-[#271815] text-base mb-1">Şifre Değiştir</h3>
          <p className="text-sm text-[#8f706b] mb-5">Hesap güvenliğiniz için güçlü bir şifre kullanın.</p>

          <form onSubmit={handlePasswordChange} className="space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Mevcut Şifre"
              required
              className={INPUT_CLASS}
            />
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="En az 8 karakter"
              required
              className={INPUT_CLASS}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Şifreyi doğrulayın"
              required
              className={INPUT_CLASS}
            />

            {pwError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <Icon name="error" className="text-[16px] flex-shrink-0" />
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
                <Icon name="check_circle" filled className="text-[16px] flex-shrink-0" />
                Şifre başarıyla güncellendi.
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={pwLoading}
                className={BTN_PRIMARY + ' flex items-center gap-2'}
              >
                {pwLoading ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
                    Güncelleniyor...
                  </>
                ) : (
                  <>
                    <Icon name="lock_reset" className="text-[17px]" />
                    Şifreyi Güncelle
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── 5. Notification Preferences Card ── */}
        <div className={CARD_CLASS}>
          <h3 className="font-black text-[#271815] text-base mb-1">Kampanya Tercihleri</h3>
          <p className="text-sm text-[#8f706b] mb-5">
            Götür'ün sunduğu fırsatlardan nasıl haberdar olmak istediğinizi seçin.
          </p>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={emailNotif}
                onChange={e => setEmailNotif(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded flex-shrink-0 cursor-pointer"
                style={{ accentColor: '#9a0002' }}
              />
              <span className="text-sm text-[#271815] leading-relaxed group-hover:text-[#9a0002] transition-colors">
                Götür'ün sunduğu kampanyalar, indirimler ve haberler ile ilgili e-posta almak istiyorum.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={smsNotif}
                onChange={e => setSmsNotif(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded flex-shrink-0 cursor-pointer"
                style={{ accentColor: '#9a0002' }}
              />
              <span className="text-sm text-[#271815] leading-relaxed group-hover:text-[#9a0002] transition-colors">
                Götür'ün sunduğu kampanyalar, indirimler ve haberler ile ilgili SMS almak istiyorum.
              </span>
            </label>
          </div>
        </div>

        {/* ── 6. Danger Zone Card ── */}
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-[0_4px_12px_rgba(39,24,21,0.06)] border border-red-200">
          <h3 className="font-black text-red-700 text-base mb-2 flex items-center gap-2">
            <Icon name="warning" filled className="text-[18px]" />
            Hesap Yönetimi
          </h3>
          <p className="text-sm text-[#8f706b] mb-5 leading-relaxed">
            Hesabınızı sildiğinizde tüm geçmiş siparişleriniz, favorileriniz ve kişisel bilgileriniz
            kalıcı olarak silinecektir. Bu işlem geri alınamaz.
          </p>
          <button
            onClick={handleDeleteAccount}
            className="flex items-center gap-2 px-6 py-3 rounded-full border-2 border-red-600 text-red-600 font-bold text-sm hover:bg-red-600 hover:text-white transition"
          >
            <Icon name="delete_forever" className="text-[17px]" />
            Hesabımı Sil
          </button>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full h-16 flex justify-around items-center bg-white border-t border-[#e4beb8] px-4 lg:hidden z-50 rounded-t-xl shadow-lg">
        {[
          { icon: 'home',         label: 'Ana Sayfa',  path: '/',        active: false },
          { icon: 'search',       label: 'Ara',        path: '/',        active: false },
          { icon: 'receipt_long', label: 'Siparişler', path: '/orders',  active: false },
          { icon: 'person',       label: 'Profil',     path: '/account', active: true  },
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

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
