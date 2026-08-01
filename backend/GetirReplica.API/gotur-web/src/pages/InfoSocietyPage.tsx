import StaticPageLayout from '../components/StaticPageLayout'

export default function InfoSocietyPage() {
  return (
    <StaticPageLayout
      title="Bilgi Toplumu Hizmetleri"
      subtitle="5651 sayılı Kanun kapsamında zorunlu bilgiler">
      <div className="space-y-8" style={{ color: 'var(--text-primary)' }}>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { label: 'Ticari Unvan', value: 'Götür Teknoloji Anonim Şirketi' },
            { label: 'Kısa Ad', value: 'Götür A.Ş.' },
            { label: 'Kuruluş Tarihi', value: '2024' },
            { label: 'Vergi Dairesi', value: 'Çankaya Vergi Dairesi' },
            { label: 'Vergi Numarası', value: '1234567890' },
            { label: 'MERSİS No', value: '0123456789012345' },
            { label: 'Adres', value: 'Mustafa Kemal Mah. Dumlupınar Blv. No:274/A Çankaya / Ankara' },
            { label: 'E-posta', value: 'info@gotur.com' },
            { label: 'Telefon', value: '0850 123 45 67' },
            { label: 'Kayıtlı Elektronik Posta', value: 'gotur@hs01.kep.tr' },
          ].map(row => (
            <div key={row.label} className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{row.label}</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.value}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Sunulan Hizmet</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Götür, internet üzerinden yemek siparişi ve teslimat aracılık hizmeti sunan bir elektronik ticaret platformudur.
            Platform, müşteriler ile restoran ortakları arasında aracı hizmet sağlayıcısı olarak faaliyet göstermektedir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>İçerik Sorumluluğu</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Platform içeriğinin yönetiminden Götür Teknoloji A.Ş. sorumludur. Restoran ortaklarının menü içerikleri
            ve fiyatlandırmaları ilgili restoran işletmecisinin sorumluluğundadır. Kullanıcıların paylaştığı yorumlar
            ve değerlendirmeler kullanıcıların kendi görüşlerini yansıtmaktadır.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Şikayet ve Bildirim</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Platform üzerindeki içeriklere ilişkin şikayet ve bildirimleriniz için
            <a href="mailto:hukuk@gotur.com" style={{ color: 'var(--accent)' }}> hukuk@gotur.com</a> adresine
            başvurabilirsiniz. Başvurular en geç 48 saat içinde değerlendirilir.
          </p>
        </section>

      </div>
    </StaticPageLayout>
  )
}
