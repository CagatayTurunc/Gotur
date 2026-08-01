import StaticPageLayout from '../components/StaticPageLayout'

export default function CookiePolicyPage() {
  return (
    <StaticPageLayout
      title="Çerez Politikası"
      subtitle="Web sitemizde kullandığımız çerezler hakkında bilgi">
      <div className="space-y-8" style={{ color: 'var(--text-primary)' }}>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Çerez Nedir?</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Çerezler, ziyaret ettiğiniz web sitesi tarafından tarayıcınıza kaydedilen küçük metin dosyalarıdır.
            Oturumunuzu açık tutmak, tercihlerinizi hatırlamak ve size daha iyi hizmet sunmak için kullanılır.
          </p>
        </section>

        {[
          {
            title: 'Zorunlu Çerezler',
            color: '#137333',
            bg: '#e6f4ea',
            items: [
              { name: 'session_token', purpose: 'Kullanıcı oturumunu açık tutar', duration: 'Oturum süresi' },
              { name: 'csrf_token', purpose: 'CSRF saldırılarına karşı güvenlik', duration: '1 saat' },
              { name: 'locale', purpose: 'Dil ve bölge tercihi', duration: '1 yıl' },
            ]
          },
          {
            title: 'Performans Çerezleri',
            color: '#1967d2',
            bg: '#e8f0fe',
            items: [
              { name: '_ga', purpose: 'Google Analytics ziyaretçi sayımı', duration: '2 yıl' },
              { name: '_gid', purpose: 'Günlük oturum takibi', duration: '24 saat' },
              { name: 'perf_session', purpose: 'Sayfa yükleme süresi ölçümü', duration: 'Oturum süresi' },
            ]
          },
          {
            title: 'Pazarlama Çerezleri',
            color: '#b45309',
            bg: '#fff3e0',
            items: [
              { name: 'ad_pref', purpose: 'Kişiselleştirilmiş reklam tercihleri', duration: '90 gün' },
              { name: 'promo_seen', purpose: 'Kampanya gösterim sayacı', duration: '30 gün' },
            ]
          },
        ].map(group => (
          <section key={group.title}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{group.title}</h2>
            </div>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-muted)' }}>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-primary)' }}>Çerez Adı</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-primary)' }}>Amacı</th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-primary)' }}>Süre</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((row, i) => (
                    <tr key={row.name} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined, backgroundColor: 'var(--bg-card)' }}>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--accent)' }}>{row.name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{row.purpose}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{row.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Çerez Tercihlerinizi Yönetin</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilirsiniz. Ancak zorunlu çerezlerin devre dışı
            bırakılması platformun düzgün çalışmamasına neden olabilir. Chrome, Firefox, Safari ve Edge tarayıcılarının
            çerez ayarları için tarayıcınızın yardım bölümünü inceleyebilirsiniz.
          </p>
        </section>
      </div>
    </StaticPageLayout>
  )
}
