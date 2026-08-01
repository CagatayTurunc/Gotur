import { useNavigate } from 'react-router-dom'
import StaticPageLayout from '../components/StaticPageLayout'
import { authService } from '../services/authService'

const STEPS = [
  { icon: 'receipt_long',    title: 'Sipariş Alındı',       desc: 'Siparişiniz restoran tarafından görüldü ve hazırlık başlıyor.' },
  { icon: 'restaurant',      title: 'Hazırlanıyor',          desc: 'Restoran siparişinizi hazırlıyor. Bu süre menüye göre değişir.' },
  { icon: 'check_circle',    title: 'Hazır — Kurye Bekleniyor', desc: 'Siparişiniz hazır, size en yakın kurye atanıyor.' },
  { icon: 'moped',           title: 'Kurye Yolda',           desc: 'Kurye restoranı teslim aldı, adresinize doğru yola çıktı.' },
  { icon: 'home',            title: 'Teslim Edildi',         desc: 'Afiyet olsun! Siparişiniz teslim edildi.' },
]

export default function OrderTrackingInfoPage() {
  const navigate = useNavigate()
  const user = authService.getUser()

  return (
    <StaticPageLayout title="Sipariş Takibi" subtitle="Siparişiniz nerede? Adım adım takip edin">
      <div className="space-y-10">

        {/* Adımlar */}
        <section>
          <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Sipariş Aşamaları</h2>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-4 items-start">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--accent-soft)', border: '2px solid var(--accent)' }}>
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>{step.icon}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-0.5 h-8 mt-1" style={{ backgroundColor: 'var(--border)' }} />
                  )}
                </div>
                <div className="pt-1.5">
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{step.title}</p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tahmini süreler */}
        <section>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Tahmini Süreler</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Hazırlık', value: '10–20 dk', icon: 'restaurant' },
              { label: 'Kurye Bekleme', value: '5–10 dk', icon: 'hourglass_top' },
              { label: 'Teslimat', value: '10–20 dk', icon: 'moped' },
            ].map(item => (
              <div key={item.label} className="p-4 rounded-xl border text-center"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <span className="material-symbols-outlined text-[28px] mb-2 block" style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                <p className="font-black text-lg" style={{ color: 'var(--accent)' }}>{item.value}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            * Süreler trafik ve hava koşullarına göre değişebilir. Toplam ortalama teslimat süresi 25–45 dakikadır.
          </p>
        </section>

        {/* CTA */}
        {user ? (
          <div className="p-5 rounded-2xl border text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Aktif siparişinizi canlı takip edin</p>
            <button onClick={() => navigate('/orders')}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-85 transition"
              style={{ backgroundColor: 'var(--accent)' }}>
              Siparişlerime Git →
            </button>
          </div>
        ) : (
          <div className="p-5 rounded-2xl border text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Sipariş takibi için giriş yapın</p>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Hesabınızdaki aktif siparişleri anlık takip edin.</p>
            <button onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-85 transition"
              style={{ backgroundColor: 'var(--accent)' }}>
              Giriş Yap
            </button>
          </div>
        )}
      </div>
    </StaticPageLayout>
  )
}
