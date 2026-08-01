import { useState } from 'react'
import StaticPageLayout from '../components/StaticPageLayout'

const FAQS = [
  { q: 'Götür nedir?', a: 'Götür, restoranlardan yemek siparişi ve market ürünleri teslimatı sunan bir Türk teknoloji platformudur. Uygulama ve web sitesi üzerinden sipariş verebilirsiniz.' },
  { q: 'Nasıl sipariş verebilirim?', a: 'Teslimat adresinizi seçin, size en yakın restoranları görün, beğendiğiniz ürünleri sepete ekleyin ve ödeme adımlarını tamamlayın. Ortalama 25-45 dakikada kapınızda.' },
  { q: 'Teslimat ücretleri nasıl belirlenir?', a: 'Teslimat ücreti, restorana olan mesafeye ve sipariş tutarına göre değişir. Belirli bir tutarın üzerindeki siparişlerde teslimat ücretsiz olabilir.' },
  { q: 'Siparişimi nasıl takip edebilirim?', a: '"Siparişlerim" sayfasından aktif siparişinizi anlık olarak takip edebilirsiniz. Kurye konumu canlı olarak harita üzerinde gösterilir.' },
  { q: 'Hangi ödeme yöntemleri kabul ediliyor?', a: 'Kredi kartı, banka kartı ve dijital cüzdan ile ödeme yapabilirsiniz. Tüm ödemeler SSL şifrelemesi ve 3D Secure ile güvence altındadır.' },
  { q: 'Siparişimi iptal edebilir miyim?', a: 'Restoran siparişi hazırlamaya başlamadan önce iptal edebilirsiniz. Hazırlık başladıktan sonra iptal için destek ekibimize ulaşın.' },
  { q: 'Yanlış veya eksik ürün geldi, ne yapmalıyım?', a: 'Teslimat sonrası 24 saat içinde uygulama veya web sitesindeki "Sorun Bildir" butonunu kullanarak bize ulaşın. İnceleme sonucuna göre iade veya yeniden gönderim yapılır.' },
  { q: 'Restoran ortağı olmak istiyorum, ne yapmalıyım?', a: '"Restoran Ortağımız Olun" sayfasından başvurabilirsiniz. Ekibimiz 2 iş günü içinde size dönüş yapacaktır.' },
  { q: 'Kurye olmak istiyorum, nasıl başvurabilirim?', a: 'Kayıt olurken "Kurye" rolünü seçin. Hesabınız onaylandıktan sonra kurye panelinden çalışmaya başlayabilirsiniz.' },
  { q: 'Uygulama hangi platformlarda mevcut?', a: 'Web tarayıcısı üzerinden gotur.site adresinden erişebilirsiniz. iOS ve Android uygulamaları yakında App Store ve Google Play\'de yayınlanacaktır.' },
  { q: 'Kişisel verilerim güvende mi?', a: 'Tüm veriler SSL/TLS ile şifrelenmiş sunucularda tutulur. 6698 Sayılı KVKK kapsamındaki haklarınız için kvkk@gotur.com adresine başvurabilirsiniz.' },
  { q: 'Fatura alabilir miyim?', a: 'Hesap ayarlarınızdan vergi numaranızı ekleyerek e-fatura alabilirsiniz. Faturalar sipariş tamamlandıktan sonra e-posta ile iletilir.' },
]

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <StaticPageLayout title="Sık Sorulan Sorular" subtitle="En çok merak edilen konuları derledik">
      <div className="max-w-3xl space-y-3">
        {FAQS.map((item, i) => (
          <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-card)' }}>
              <span className="text-sm font-semibold pr-4" style={{ color: 'var(--text-primary)' }}>{item.q}</span>
              <span
                className="material-symbols-outlined text-[20px] flex-shrink-0 transition-transform duration-200"
                style={{ color: 'var(--accent)', transform: open === i ? 'rotate(180deg)' : 'none' }}>
                expand_more
              </span>
            </button>
            {open === i && (
              <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-page)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.a}</p>
              </div>
            )}
          </div>
        ))}

        <div className="mt-8 p-5 rounded-2xl border text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Aradığınızı bulamadınız mı?</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Destek ekibimiz size yardımcı olmaktan memnuniyet duyar.</p>
          <a href="mailto:destek@gotur.com"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white hover:opacity-85 transition"
            style={{ backgroundColor: 'var(--accent)' }}>
            <span className="material-symbols-outlined text-[16px]">mail</span>
            destek@gotur.com
          </a>
        </div>
      </div>
    </StaticPageLayout>
  )
}
