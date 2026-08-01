import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../services/authService'

type Step = 'form' | 'success' | 'error'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const email = searchParams.get('email') ?? ''
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showPass2, setShowPass2] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>(!email || !token ? 'error' : 'form')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.')
      return
    }
    if (!/\d/.test(password)) {
      setError('Şifre en az bir rakam içermelidir.')
      return
    }
    if (password !== password2) {
      setError('Şifreler eşleşmiyor.')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword(email, token, password)
      setStep('success')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Şifre sıfırlanamadı. Bağlantı geçersiz veya süresi dolmuş olabilir.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#9a0002] px-8 py-6 text-center">
          <button onClick={() => navigate('/')} className="text-2xl font-black italic tracking-tight text-white">
            Götür
          </button>
        </div>

        <div className="px-8 py-8">
          {step === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px] text-red-500">link_off</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Geçersiz Bağlantı</h2>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.<br />
                Yeni bir bağlantı talep edebilirsiniz.
              </p>
              <button
                onClick={() => navigate('/login', { state: { openForgot: true } })}
                className="w-full bg-[#9a0002] hover:bg-[#7a0001] text-white py-3 rounded-full text-sm font-bold transition-all"
              >
                Yeni Bağlantı İste
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                Anasayfaya Dön
              </button>
            </div>
          )}

          {step === 'form' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Yeni Şifre Belirle</h2>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{email}</span> hesabı için yeni şifrenizi girin.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Şifre */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Yeni Şifre</label>
                  <div className="relative">
                    <input
                      required
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="En az 6 karakter, rakam içermeli"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 pr-11 text-sm focus:ring-2 focus:ring-[#9a0002] focus:border-[#9a0002] outline-none transition-all text-gray-900 placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPass ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Şifre Tekrar */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Şifre Tekrar</label>
                  <div className="relative">
                    <input
                      required
                      type={showPass2 ? 'text' : 'password'}
                      value={password2}
                      onChange={e => setPassword2(e.target.value)}
                      placeholder="Şifrenizi tekrar girin"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 pr-11 text-sm focus:ring-2 focus:ring-[#9a0002] focus:border-[#9a0002] outline-none transition-all text-gray-900 placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass2(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPass2 ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Şifre gücü ipucu */}
                {password && (
                  <div className="flex items-start gap-2 text-xs text-gray-500">
                    <div className="flex flex-col gap-0.5 w-full">
                      <div className="flex items-center gap-1.5">
                        <span className={`material-symbols-outlined text-[14px] ${password.length >= 6 ? 'text-green-500' : 'text-gray-300'}`}>
                          {password.length >= 6 ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={password.length >= 6 ? 'text-green-600' : ''}>En az 6 karakter</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`material-symbols-outlined text-[14px] ${/\d/.test(password) ? 'text-green-500' : 'text-gray-300'}`}>
                          {/\d/.test(password) ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={/\d/.test(password) ? 'text-green-600' : ''}>En az bir rakam</span>
                      </div>
                      {password2 && (
                        <div className="flex items-center gap-1.5">
                          <span className={`material-symbols-outlined text-[14px] ${password === password2 ? 'text-green-500' : 'text-red-400'}`}>
                            {password === password2 ? 'check_circle' : 'cancel'}
                          </span>
                          <span className={password === password2 ? 'text-green-600' : 'text-red-500'}>
                            Şifreler {password === password2 ? 'eşleşiyor' : 'eşleşmiyor'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#9a0002] hover:bg-[#7a0001] text-white py-3.5 rounded-full text-sm font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-60 mt-1"
                >
                  {loading ? 'Güncelleniyor...' : 'Şifremi Güncelle'}
                </button>
              </form>

              <button
                onClick={() => navigate('/')}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors mt-4 py-1"
              >
                Vazgeç, giriş sayfasına dön
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px] text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Şifreniz Güncellendi!</h2>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Yeni şifreniz başarıyla kaydedildi.<br />
                Giriş yaparak siparişlerinize devam edebilirsiniz.
              </p>
              <button
                onClick={() => navigate('/', { state: { openLogin: true } })}
                className="w-full bg-[#9a0002] hover:bg-[#7a0001] text-white py-3 rounded-full text-sm font-bold transition-all"
              >
                Giriş Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
