import StaticPageLayout from '../components/StaticPageLayout'

export default function TermsPage() {
  return (
    <StaticPageLayout
      title="Kullanım Koşulları"
      subtitle="Son güncellenme: 1 Ocak 2026">
      <div className="prose prose-sm md:prose max-w-none space-y-8" style={{ color: 'var(--text-primary)' }}>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>1. Hizmet Tanımı</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Götür, restoranlardan yemek siparişi ve market ürünlerinin teslimatı hizmetini sunan bir teknoloji platformudur.
            Platform üzerinden sipariş veren kullanıcılar ("Müşteri"), restoran işletmecileri ("Restoran Ortağı") ve
            teslimat yapan kuryeler ("Kurye") bu koşulları kabul etmiş sayılır.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>2. Kullanıcı Yükümlülükleri</h2>
          <ul className="space-y-2" style={{ color: 'var(--text-secondary)' }}>
            <li>• Kayıt sırasında doğru ve güncel bilgi vermek</li>
            <li>• Hesap güvenliğini sağlamak ve şifrenizi korumak</li>
            <li>• Platformu yasalara uygun kullanmak</li>
            <li>• Ödeme bilgilerini güncel tutmak</li>
            <li>• Teslimat adresini doğru ve eksiksiz girmek</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>3. Sipariş ve İptal Koşulları</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Siparişiniz onaylandıktan sonra iptal hakkı sınırlıdır. Restoran hazırlığa başlamadan önce iptal edilen
            siparişlerde ücret iadesi yapılır. Hazırlık başladıktan sonraki iptallerde restoran politikası geçerlidir.
            Hatalı veya eksik gelen siparişler için 24 saat içinde destek ekibimize başvurabilirsiniz.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>4. Ödeme ve Faturalama</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Kredi kartı, banka kartı ve online ödeme yöntemleri kabul edilmektedir. Ödeme güvenliği 3D Secure ile
            sağlanır. Faturalar e-posta adresinize otomatik gönderilir. Kurumsal fatura için hesap ayarlarınızdan
            vergi bilgilerinizi girebilirsiniz.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>5. Sorumluluk Sınırları</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Götür, restoran ortakları tarafından hazırlanan yemeklerin kalitesi, hijyeni veya içeriğinden sorumlu değildir.
            Teslimat süresi tahminidir ve trafik, hava koşulları gibi dış etkenlerden etkilenebilir. Platform, teknik
            arızalar veya bakım çalışmaları sırasında geçici olarak erişilemez olabilir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>6. Değişiklik Hakkı</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Götür, bu kullanım koşullarını önceden haber vermeksizin değiştirme hakkını saklı tutar. Güncel koşullar
            her zaman bu sayfada yayınlanır. Değişikliklerden sonra platformu kullanmaya devam etmeniz, yeni koşulları
            kabul ettiğiniz anlamına gelir.
          </p>
        </section>

        <div className="mt-10 p-4 rounded-lg border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <strong>Sorularınız için:</strong> <a href="mailto:destek@gotur.com" className="underline" style={{ color: 'var(--accent)' }}>destek@gotur.com</a>
          </p>
        </div>
      </div>
    </StaticPageLayout>
  )
}
