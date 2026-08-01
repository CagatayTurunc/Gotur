import StaticPageLayout from '../components/StaticPageLayout'

export default function PrivacyPage() {
  return (
    <StaticPageLayout
      title="Gizlilik Politikası"
      subtitle="Kişisel verileriniz bizim için önemlidir">
      <div className="prose prose-sm md:prose max-w-none space-y-8" style={{ color: 'var(--text-primary)' }}>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>1. Toplanan Veriler</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Götür platformunu kullanırken aşağıdaki kişisel verileriniz toplanmaktadır:
          </p>
          <ul className="space-y-2" style={{ color: 'var(--text-secondary)' }}>
            <li>• <strong>Kimlik Bilgileri:</strong> Ad, soyad, e-posta adresi, telefon numarası</li>
            <li>• <strong>Konum Bilgileri:</strong> Teslimat adresi, GPS koordinatları (izin vermeniz halinde)</li>
            <li>• <strong>Ödeme Bilgileri:</strong> Kredi kartı son 4 hanesi, ödeme geçmişi</li>
            <li>• <strong>Sipariş Bilgileri:</strong> Sipariş geçmişi, tercihler, restoran değerlendirmeleri</li>
            <li>• <strong>Teknik Veriler:</strong> IP adresi, tarayıcı bilgisi, cihaz türü, çerez verileri</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>2. Verilerin Kullanım Amaçları</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Toplanan veriler yalnızca aşağıdaki amaçlarla kullanılır: Sipariş işlemlerinin gerçekleştirilmesi,
            teslimat koordinasyonu, ödeme işlemleri, müşteri desteği, kişiselleştirilmiş kampanya ve öneriler,
            platform güvenliği ve hizmet iyileştirmeleri.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>3. Veri Paylaşımı</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Kişisel verileriniz yalnızca hizmetin ifası için gerekli taraflarla paylaşılır: Sipariş verdiğiniz
            restoran, teslimatı gerçekleştiren kurye, ödeme işlemcileri (Stripe, PayTR vb.), yasal yükümlülükler
            gereği resmi kurumlar. Verileriniz hiçbir zaman pazarlama amaçlı üçüncü taraflara satılmaz.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>4. Veri Güvenliği</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            SSL/TLS şifrelemesi, güvenli sunucu altyapısı, düzenli güvenlik denetimleri ve erişim kontrolleri ile
            verileriniz korunmaktadır. Ödeme bilgileri hiçbir zaman sunucularımızda saklanmaz, sadece ödeme
            sağlayıcıları üzerinden işleme alınır.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>5. Kullanıcı Hakları (KVKK)</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında sahip olduğunuz haklar:
          </p>
          <ul className="space-y-2" style={{ color: 'var(--text-secondary)' }}>
            <li>• Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
            <li>• İşlenmişse bilgi talep etme</li>
            <li>• İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
            <li>• Yurt içinde / yurt dışında aktarıldığı 3. kişileri bilme</li>
            <li>• Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme</li>
            <li>• Verilerin silinmesini veya yok edilmesini talep etme</li>
            <li>• İşleme faaliyetine itiraz etme</li>
          </ul>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: '12px' }}>
            Bu haklarınızı kullanmak için <a href="mailto:kvkk@gotur.com" className="underline" style={{ color: 'var(--accent)' }}>kvkk@gotur.com</a> adresine başvurabilirsiniz.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>6. Çerezler (Cookies)</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Platformumuz, kullanıcı deneyimini iyileştirmek için çerezler kullanmaktadır. Zorunlu çerezler (oturum,
            güvenlik), performans çerezleri (analitik) ve pazarlama çerezleri (reklam kişiselleştirme) kullanılmaktadır.
            Çerez tercihlerinizi ayarlar menüsünden değiştirebilirsiniz.
          </p>
        </section>

        <div className="mt-10 p-4 rounded-lg border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <strong>Veri Sorumlusu:</strong> Götür Teknoloji A.Ş. | <strong>İletişim:</strong> kvkk@gotur.com
          </p>
        </div>
      </div>
    </StaticPageLayout>
  )
}
