import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { restaurantService, type SubmitApplicationRequest } from '../services/restaurantService'
import { authService } from '../services/authService'

const CATEGORIES = ['Fast Food', 'Pizza', 'Döner', 'Burger', 'Tavuk', 'Deniz Ürünleri', 'Türk Mutfağı',
  'Kahvaltı', 'Tatlı & Pastane', 'Sağlıklı', 'Vegan', 'Dünya Mutfağı', 'Diğer']

const CITIES = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep',
  'Konya', 'Kayseri', 'Mersin', 'Eskişehir', 'Diyarbakır', 'Diğer']

export default function PartnerApplyPage() {
  const navigate = useNavigate()
  const currentUser = authService.getUser()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submittedId, setSubmittedId] = useState('')

  const [form, setForm] = useState<SubmitApplicationRequest>({
    restaurantName: '',
    ownerName: currentUser?.fullName ?? '',
    email: currentUser?.email ?? '',
    phone: '',
    address: '', city: '', category: '', description: '', taxNumber: '',
  })
  const [password, setPassword]       = useState('')
  const [passwordConf, setPasswordConf] = useState('')
  const [showPass, setShowPass]       = useState(false)

  const set = (k: keyof SubmitApplicationRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const passwordValid = currentUser || (password.length >= 6 && password === passwordConf)
  const step1Valid = form.restaurantName && form.ownerName && form.email && form.phone && passwordValid
  const step2Valid = form.address && form.city && form.category

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        password: currentUser ? undefined : password,
      }
      const res = await restaurantService.submitApplication(payload)
      setSubmittedId(res.id)
      setStep(3)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fff8f6' }}>
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#fff', borderColor: '#e4beb8' }}>
        <button onClick={() => navigate('/')} className="flex items-center gap-2 font-black text-xl italic" style={{ color: '#6f0001' }}>
          Götür
        </button>
        <span className="text-sm font-semibold" style={{ color: '#5b403c' }}>Restoran Ortaklık Başvurusu</span>
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: '#f9dcd7', color: '#6f0001' }}>
              <div className="w-6 h-6 rounded-full bg-[#6f0001] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {currentUser.fullName.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold hidden sm:block">{currentUser.fullName}</span>
            </div>
          ) : (
            <button onClick={() => navigate('/', { state: { openLogin: true } })}
              className="text-sm font-semibold px-4 py-1.5 rounded-full text-white"
              style={{ backgroundColor: '#6f0001' }}>
              Giriş Yap
            </button>
          )}
          <button onClick={() => navigate('/')} className="text-sm hover:underline" style={{ color: '#6f0001' }}>
            Ana Sayfa
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Başlık */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: '#ffe2dd' }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: '#6f0001' }}>storefront</span>
          </div>
          <h1 className="text-3xl font-black mb-2" style={{ color: '#271815' }}>Restoran Ortağımız Olun</h1>
          <p className="text-base" style={{ color: '#5b403c' }}>
            Milyonlarca müşteriye ulaşın, işinizi büyütün. Başvurunuzu gönderin, ekibimiz 2 iş günü içinde sizinle iletişime geçsin.
          </p>
        </div>

        {/* Adım göstergesi */}
        {step < 3 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: step >= s ? '#6f0001' : '#f9dcd7', color: step >= s ? '#fff' : '#5b403c' }}>
                  {s}
                </div>
                <span className="text-sm font-medium" style={{ color: step >= s ? '#6f0001' : '#5b403c' }}>
                  {s === 1 ? 'İletişim Bilgileri' : 'İşletme Detayları'}
                </span>
                {s < 2 && <div className="w-12 h-px mx-1" style={{ backgroundColor: step > s ? '#6f0001' : '#e4beb8' }} />}
              </div>
            ))}
          </div>
        )}

        {/* Başarı ekranı */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border p-10 text-center" style={{ borderColor: '#e4beb8', boxShadow: '0 4px 20px rgba(32,16,0,0.08)' }}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#e6f4ea' }}>
              <span className="material-symbols-outlined text-[40px]" style={{ color: '#137333', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <h2 className="text-2xl font-black mb-2" style={{ color: '#271815' }}>Başvurunuz Alındı!</h2>
            <p className="mb-4" style={{ color: '#5b403c' }}>
              Başvurunuz başarıyla gönderildi. Ekibimiz en kısa sürede{' '}
              <strong>{form.email}</strong> adresine dönüş yapacak.
            </p>
            <div className="text-xs font-mono px-3 py-1.5 rounded inline-block mb-3" style={{ backgroundColor: '#f9dcd7', color: '#6f0001' }}>
              Başvuru No: {submittedId.slice(0, 8).toUpperCase()}
            </div>

            {/* Bilgi kutusu */}
            <div className="rounded-xl p-4 mb-6 text-left" style={{ backgroundColor: '#fff8f6', border: '1px solid #e4beb8' }}>
              <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: '#271815' }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: '#6f0001' }}>info</span>
                Sonraki adımlar
              </p>
              <ul className="space-y-1.5 text-sm" style={{ color: '#5b403c' }}>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#6f0001] font-bold">1.</span>
                  Admin ekibimiz başvurunuzu inceleyecek (genellikle 1-2 iş günü).
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#6f0001] font-bold">2.</span>
                  Onaylanırsa <strong>{form.email}</strong> adresiniz ve belirlediğiniz şifreyle giriş yapabileceksiniz.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#6f0001] font-bold">3.</span>
                  Restoran panelinizden menü, siparişler ve analizlerinizi yönetebilirsiniz.
                </li>
              </ul>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              {currentUser ? (
                <button onClick={() => navigate('/')}
                  className="px-6 py-2.5 rounded-full text-sm font-bold border"
                  style={{ borderColor: '#6f0001', color: '#6f0001' }}>
                  Ana Sayfaya Dön
                </button>
              ) : (
                <>
                  <button onClick={() => navigate('/', { state: { openLogin: true } })}
                    className="px-6 py-2.5 rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: '#6f0001' }}>
                    Giriş Yap
                  </button>
                  <button onClick={() => navigate('/')}
                    className="px-6 py-2.5 rounded-full text-sm font-bold border"
                    style={{ borderColor: '#6f0001', color: '#6f0001' }}>
                    Ana Sayfaya Dön
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Adım 1 */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#e4beb8', boxShadow: '0 4px 20px rgba(32,16,0,0.08)' }}>
            <h2 className="text-lg font-bold mb-5" style={{ color: '#271815' }}>İletişim ve İşletme Sahibi Bilgileri</h2>

            {/* Giriş yapmış kullanıcı için bilgi bandı */}
            {currentUser && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-sm" style={{ backgroundColor: '#e6f4ea', color: '#137333' }}>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                <span>Hesabınız bağlı — ad ve e-posta otomatik dolduruldu.</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                  Restoran Adı <span style={{ color: '#6f0001' }}>*</span>
                </label>
                <input value={form.restaurantName} onChange={set('restaurantName')} type="text"
                  placeholder="Örn: Coni & Co Burger"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                  style={{ borderColor: '#e4beb8', color: '#271815' }}
                  onFocus={e => e.target.style.borderColor = '#6f0001'}
                  onBlur={e => e.target.style.borderColor = '#e4beb8'} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                  İşletme Sahibi Adı Soyadı <span style={{ color: '#6f0001' }}>*</span>
                </label>
                <input value={form.ownerName} onChange={set('ownerName')} type="text"
                  placeholder="Ad Soyad"
                  readOnly={!!currentUser}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                  style={{ borderColor: '#e4beb8', color: '#271815', backgroundColor: currentUser ? '#fafafa' : undefined }}
                  onFocus={e => { if (!currentUser) e.target.style.borderColor = '#6f0001' }}
                  onBlur={e => e.target.style.borderColor = '#e4beb8'} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                    E-posta <span style={{ color: '#6f0001' }}>*</span>
                  </label>
                  <input value={form.email} onChange={set('email')} type="email"
                    placeholder="email@ornek.com"
                    readOnly={!!currentUser}
                    className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                    style={{ borderColor: '#e4beb8', color: '#271815', backgroundColor: currentUser ? '#fafafa' : undefined }}
                    onFocus={e => { if (!currentUser) e.target.style.borderColor = '#6f0001' }}
                    onBlur={e => e.target.style.borderColor = '#e4beb8'} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                    Telefon <span style={{ color: '#6f0001' }}>*</span>
                  </label>
                  <input value={form.phone} onChange={set('phone')} type="tel"
                    placeholder="0532 000 00 00"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                    style={{ borderColor: '#e4beb8', color: '#271815' }}
                    onFocus={e => e.target.style.borderColor = '#6f0001'}
                    onBlur={e => e.target.style.borderColor = '#e4beb8'} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                  Vergi Numarası <span className="text-xs font-normal" style={{ color: '#5b403c' }}>(opsiyonel)</span>
                </label>
                <input value={form.taxNumber ?? ''} onChange={set('taxNumber')} type="text"
                  placeholder="1234567890"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                  style={{ borderColor: '#e4beb8', color: '#271815' }}
                  onFocus={e => e.target.style.borderColor = '#6f0001'}
                  onBlur={e => e.target.style.borderColor = '#e4beb8'} />
              </div>

              {/* Şifre — sadece giriş yapmadan başvuruluyorsa */}
              {!currentUser && (
                <>
                  <div className="pt-2 border-t" style={{ borderColor: '#f9dcd7' }}>
                    <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: '#5b403c' }}>
                      <span className="material-symbols-outlined text-[16px]" style={{ color: '#6f0001' }}>lock</span>
                      Başvurunuz onaylandığında bu şifreyle giriş yapacaksınız.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                          Şifre <span style={{ color: '#6f0001' }}>*</span>
                        </label>
                        <div className="relative">
                          <input
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            type={showPass ? 'text' : 'password'}
                            placeholder="En az 6 karakter"
                            className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all pr-10"
                            style={{ borderColor: password && password.length < 6 ? '#c5221f' : '#e4beb8', color: '#271815' }}
                            onFocus={e => e.target.style.borderColor = '#6f0001'}
                            onBlur={e => e.target.style.borderColor = (password && password.length < 6) ? '#c5221f' : '#e4beb8'} />
                          <button type="button" onClick={() => setShowPass(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-80"
                            style={{ color: '#5b403c' }}>
                            <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                        {password && password.length < 6 && (
                          <p className="text-xs mt-1" style={{ color: '#c5221f' }}>En az 6 karakter olmalı</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                          Şifre Tekrar <span style={{ color: '#6f0001' }}>*</span>
                        </label>
                        <input
                          value={passwordConf}
                          onChange={e => setPasswordConf(e.target.value)}
                          type={showPass ? 'text' : 'password'}
                          placeholder="Şifreyi tekrar girin"
                          className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                          style={{ borderColor: passwordConf && password !== passwordConf ? '#c5221f' : '#e4beb8', color: '#271815' }}
                          onFocus={e => e.target.style.borderColor = '#6f0001'}
                          onBlur={e => e.target.style.borderColor = (passwordConf && password !== passwordConf) ? '#c5221f' : '#e4beb8'} />
                        {passwordConf && password !== passwordConf && (
                          <p className="text-xs mt-1" style={{ color: '#c5221f' }}>Şifreler eşleşmiyor</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setStep(2)} disabled={!step1Valid}
              className="w-full mt-6 py-3 rounded-full font-bold text-sm text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: '#6f0001' }}>
              Devam Et →
            </button>
          </div>
        )}

        {/* Adım 2 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#e4beb8', boxShadow: '0 4px 20px rgba(32,16,0,0.08)' }}>
            <h2 className="text-lg font-bold mb-5" style={{ color: '#271815' }}>İşletme Konumu ve Kategorisi</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                  Açık Adres <span style={{ color: '#6f0001' }}>*</span>
                </label>
                <input value={form.address} onChange={set('address')} type="text"
                  placeholder="Mahalle, Cadde/Sokak No"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                  style={{ borderColor: '#e4beb8', color: '#271815' }}
                  onFocus={e => e.target.style.borderColor = '#6f0001'}
                  onBlur={e => e.target.style.borderColor = '#e4beb8'} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                    Şehir <span style={{ color: '#6f0001' }}>*</span>
                  </label>
                  <select value={form.city} onChange={set('city')}
                    className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                    style={{ borderColor: '#e4beb8', color: form.city ? '#271815' : '#9a8f85' }}>
                    <option value="">Şehir seçin</option>
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                    Kategori <span style={{ color: '#6f0001' }}>*</span>
                  </label>
                  <select value={form.category} onChange={set('category')}
                    className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                    style={{ borderColor: '#e4beb8', color: form.category ? '#271815' : '#9a8f85' }}>
                    <option value="">Kategori seçin</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#271815' }}>
                  İşletmeniz Hakkında <span className="text-xs font-normal" style={{ color: '#5b403c' }}>(opsiyonel)</span>
                </label>
                <textarea value={form.description ?? ''} onChange={set('description')} rows={3}
                  placeholder="Mutfak türünüz, özel ürünleriniz, hizmet saatleriniz..."
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all resize-none"
                  style={{ borderColor: '#e4beb8', color: '#271815' }}
                  onFocus={e => e.target.style.borderColor = '#6f0001'}
                  onBlur={e => e.target.style.borderColor = '#e4beb8'} />
              </div>
            </div>
            {error && (
              <div className="mt-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#fce8e6', color: '#c5221f' }}>
                {error}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-full font-bold text-sm border transition-colors"
                style={{ borderColor: '#6f0001', color: '#6f0001' }}>
                ← Geri
              </button>
              <button onClick={handleSubmit} disabled={!step2Valid || loading}
                className="flex-1 py-3 rounded-full font-bold text-sm text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: '#6f0001' }}>
                {loading ? 'Gönderiliyor...' : 'Başvuruyu Gönder'}
              </button>
            </div>
          </div>
        )}

        {/* Avantajlar */}
        {step < 3 && (
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { icon: 'people', title: 'Geniş Müşteri Kitlesi', desc: 'Milyonlarca aktif kullanıcıya ulaşın' },
              { icon: 'analytics', title: 'Gelişmiş Analitik', desc: 'Satış ve performans takibi yapın' },
              { icon: 'support_agent', title: '7/24 Destek', desc: 'Uzman ekibimiz her zaman yanınızda' },
            ].map(item => (
              <div key={item.title} className="text-center p-4 rounded-xl" style={{ backgroundColor: '#fff0ee' }}>
                <span className="material-symbols-outlined text-[28px] mb-2 block" style={{ color: '#6f0001', fontVariationSettings: "'FILL' 1" }}>
                  {item.icon}
                </span>
                <p className="text-xs font-bold mb-1" style={{ color: '#271815' }}>{item.title}</p>
                <p className="text-xs" style={{ color: '#5b403c' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
