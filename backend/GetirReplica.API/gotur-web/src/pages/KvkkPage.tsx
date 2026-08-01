import StaticPageLayout from '../components/StaticPageLayout'

export default function KvkkPage() {
  return (
    <StaticPageLayout
      title="KVKK Aydınlatma Metni"
      subtitle="6698 Sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma">
      <div className="space-y-8" style={{ color: 'var(--text-primary)' }}>

        <div className="p-5 rounded-xl border-l-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent)', borderWidth: '0 0 0 4px', border: '1px solid var(--border)', borderLeftColor: 'var(--accent)', borderLeftWidth: '4px' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--accent)' }}>Veri Sorumlusu</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <strong>Götür Teknoloji A.Ş.</strong> — Merkez: Ankara, Türkiye<br />
            İletişim: <a href="mailto:kvkk@gotur.com" style={{ color: 'var(--accent)' }}>kvkk@gotur.com</a>
          </p>
        </div>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>1. İşlenen Kişisel Veriler</h2>
          {[
            { cat: 'Kimlik', items: 'Ad soyad, T.C. kimlik numarası (fatura için), doğum tarihi' },
            { cat: 'İletişim', items: 'E-posta adresi, telefon numarası, teslimat adresi' },
            { cat: 'Konum', items: 'GPS koordinatları, teslimat noktası, IP adresi' },
            { cat: 'Finans', items: 'Ödeme yöntemi türü, sipariş tutarı (kart numarası işlenmez)' },
            { cat: 'Müşteri İşlem', items: 'Sipariş geçmişi, favori restoranlar, değerlendirmeler' },
            { cat: 'Pazarlama', items: 'Kampanya etkileşimleri, tercih edilen mutfak türleri' },
          ].map(row => (
            <div key={row.cat} className="flex gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-bold w-32 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{row.cat}</span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{row.items}</span>
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>2. İşleme Amaçları ve Hukuki Dayanak</h2>
          {[
            { amaç: 'Sipariş ve teslimat hizmeti', dayanak: 'Sözleşmenin ifası (KVKK m.5/2-c)' },
            { amaç: 'Ödeme işlemleri', dayanak: 'Hukuki yükümlülük (KVKK m.5/2-ç)' },
            { amaç: 'Müşteri desteği', dayanak: 'Meşru menfaat (KVKK m.5/2-f)' },
            { amaç: 'Kişiselleştirilmiş kampanya', dayanak: 'Açık rıza (KVKK m.5/1)' },
            { amaç: 'Hukuki uyumluluk ve denetim', dayanak: 'Kanuni yükümlülük (KVKK m.5/2-ç)' },
          ].map((row, i) => (
            <div key={i} className="flex gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm w-52 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{row.amaç}</span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{row.dayanak}</span>
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>3. Verilerin Aktarıldığı Taraflar</h2>
          <ul className="space-y-2" style={{ color: 'var(--text-secondary)' }}>
            <li>• <strong>Restoran ortakları:</strong> Siparişin hazırlanması için ad, teslimat notu</li>
            <li>• <strong>Kurye:</strong> Teslimat için adres ve iletişim bilgileri</li>
            <li>• <strong>Ödeme sağlayıcıları:</strong> Ödeme işlemi için şifreli veri aktarımı</li>
            <li>• <strong>Kargo/harita servisleri:</strong> Konum optimizasyonu için anonimleştirilmiş konum</li>
            <li>• <strong>Yasal merciler:</strong> Mahkeme kararı veya yasal zorunluluk halinde</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>4. Haklarınız (KVKK Madde 11)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Kişisel verilerinizin işlenip işlenmediğini öğrenme',
              'İşlenmişse bilgi talep etme',
              'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme',
              'Yurt içinde veya yurt dışında aktarıldığı 3. kişileri bilme',
              'Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme',
              'KVKK\'da öngörülen şartlar çerçevesinde silinmesini isteme',
              'Düzeltme ve silme işlemlerinin aktarılan kişilere bildirilmesini isteme',
              'Otomatik sistemler vasıtasıyla işlenen veriler aleyhine çıkan sonuca itiraz',
              'Kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme',
            ].map(hak => (
              <div key={hak} className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{hak}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>5. Başvuru Yöntemi</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            KVKK kapsamındaki haklarınızı kullanmak için kimliğinizi doğrulayan belgelerle birlikte
            <a href="mailto:kvkk@gotur.com" style={{ color: 'var(--accent)' }}> kvkk@gotur.com</a> adresine e-posta gönderebilirsiniz.
            Başvurular 30 gün içinde sonuçlandırılır.
          </p>
        </section>

      </div>
    </StaticPageLayout>
  )
}
