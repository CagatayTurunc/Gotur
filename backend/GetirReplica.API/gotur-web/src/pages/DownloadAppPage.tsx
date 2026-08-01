import StaticPageLayout from '../components/StaticPageLayout'

export default function DownloadAppPage() {
  return (
    <StaticPageLayout title="Uygulamayı İndir" subtitle="Götür'ü her zaman yanınızda taşıyın">
      <div className="space-y-12">

        {/* Hero */}
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1 space-y-5">
            <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
              İlk siparişe <span style={{ color: 'var(--accent)' }}>250 ₺ indirim</span> kazan
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Uygulamayı indir, ilk siparişinde 250 ₺ indirim kuponu otomatik tanımlanır.
              Anlık bildirimler, kolay sipariş takibi ve özel uygulama kampanyaları seni bekliyor.
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { store: 'App Store', icon: 'phone_iphone', sub: 'iOS 14+ gerektirir', badge: 'Yakında' },
                { store: 'Google Play', icon: 'android', sub: 'Android 8+ gerektirir', badge: 'Yakında' },
              ].map(s => (
                <button key={s.store}
                  className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border transition-all hover:shadow-md relative"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--accent)' }}>{s.icon}</span>
                  <div className="text-left">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>İndir</p>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{s.store}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.sub}</p>
                  </div>
                  <span className="absolute -top-2 -right-2 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--accent)' }}>{s.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* QR */}
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="bg-white p-3 rounded-xl shadow">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCC6Pgnq9IA4t6VMPuCMqdMfdTao_vjoM6-oRymUxPCygBliNdHDo0AhzyWFBDY1gSax6_pPl-W0LmCSQQeuDl1d49mRYkW5eKmC5SPOD3rujUO-a79vRjZGNMKwfFcRc8iPsWK4jJBFHuAR49qLICCJUHw570DKYE2yhW_XIVf2e5sYv1DEQzlwji-67Z4vZStI558EPyY7WakPJA8ZmSaEAajJf7lF_CG7rhMgJ7FuaoO1NHlBn_h1UHPF2TccaRr9R9gJTds9qs"
                alt="QR Kod"
                className="w-36 h-36 object-cover rounded"
              />
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
              QR kodu tara,<br />uygulamayı indir
            </p>
          </div>
        </div>

        {/* Özellikler */}
        <section>
          <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Uygulama Özellikleri</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: 'notifications_active', title: 'Anlık Bildirimler', desc: 'Siparişinizin her adımında anında haberdar olun.' },
              { icon: 'location_on', title: 'Canlı Takip', desc: 'Kuryenizi harita üzerinde anlık takip edin.' },
              { icon: 'favorite', title: 'Favori Listesi', desc: 'Sevdiğiniz restoranları ve yemekleri kaydedin.' },
              { icon: 'local_offer', title: 'Özel Kampanyalar', desc: 'Uygulamaya özel indirim ve fırsatlardan yararlanın.' },
              { icon: 'history', title: 'Sipariş Geçmişi', desc: 'Önceki siparişlerinizi kolayca tekrarlayın.' },
              { icon: 'payment', title: 'Hızlı Ödeme', desc: 'Kayıtlı kartınızla tek tıkla ödeme yapın.' },
            ].map(f => (
              <div key={f.title} className="flex gap-3 p-4 rounded-xl border"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <span className="material-symbols-outlined text-[22px] flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{f.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </StaticPageLayout>
  )
}
