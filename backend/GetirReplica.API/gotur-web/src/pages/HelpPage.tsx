import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaticPageLayout from '../components/StaticPageLayout'

const FAQS = [
  {
    cat: 'Sipariş',
    icon: 'receipt_long',
    items: [
      { q: 'Siparişimi nasıl iptal edebilirim?', a: 'Sipariş hazırlığa başlamadan önce "Siparişlerim" sayfasından iptal edebilirsiniz. Restoran hazırlığa başladıktan sonra iptal için destek ekibimize ulaşın.' },
      { q: 'Siparişim ne zaman gelir?', a: 'Ortalama teslimat süresi 25-45 dakikadır. Anlık takip için sipariş takip sayfanızı kontrol edin.' },
      { q: 'Eksik veya yanlış ürün geldi, ne yapmalıyım?', a: 'Sipariş tesliminden itibaren 24 saat içinde uygulama üzerinden "Sorun bildir" butonuna basın. Ekibimiz en kısa sürede dönüş yapacaktır.' },
      { q: 'Minimum sipariş tutarı var mı?', a: 'Her restoranın kendi minimum sipariş tutarı vardır. Restoran sayfasında bu bilgiyi görebilirsiniz.' },
    ]
  },
  {
    cat: 'Ödeme',
    icon: 'payment',
    items: [
      { q: 'Hangi ödeme yöntemleri kabul ediliyor?', a: 'Kredi kartı, banka kartı ve online ödeme kabul edilmektedir. Tüm ödemeler 3D Secure ile güvence altındadır.' },
      { q: 'İade ne zaman hesabıma yansır?', a: 'Onaylanan iadeler 3-7 iş günü içinde hesabınıza yansır. Bu süre bankanıza göre değişebilir.' },
      { q: 'Fatura alabilir miyim?', a: 'Evet, hesap ayarlarınızdan vergi bilgilerinizi ekleyerek e-fatura alabilirsiniz.' },
    ]
  },
  {
    cat: 'Hesap',
    icon: 'person',
    items: [
      { q: 'Şifremi nasıl değiştirebilirim?', a: 'Hesabım > Güvenlik > Şifre Değiştir bölümünden mevcut şifrenizle doğrulama yaparak yeni şifre belirleyebilirsiniz.' },
      { q: 'Hesabımı nasıl silerim?', a: 'Hesabım sayfasının alt kısmındaki "Hesabı Sil" seçeneğiyle hesabınızı kalıcı olarak kapatabilirsiniz. Bu işlem geri alınamaz.' },
      { q: 'E-posta adresimi değiştirebilir miyim?', a: 'Şu an için e-posta değişikliği destek ekibimiz aracılığıyla yapılmaktadır. destek@gotur.com adresine yazabilirsiniz.' },
    ]
  },
  {
    cat: 'Teslimat',
    icon: 'local_shipping',
    items: [
      { q: 'Teslimat alanım dışına sipariş verebilir miyim?', a: 'Hayır, her restoran belirli bir teslimat yarıçapında hizmet vermektedir. Adresiniz bu alan dışındaysa ilgili restoran görüntülenmez.' },
      { q: 'Kurye kapıya gelemedi, ne olur?', a: 'Kurye 2 kez arama yapacaktır. Ulaşılamazsa sipariş iptal edilebilir ve ücret iade edilir. Teslimat notuna kapı kodu veya yönlendirme ekleyebilirsiniz.' },
    ]
  },
]

export default function HelpPage() {
  const [openIdx, setOpenIdx] = useState<string | null>(null)
  const navigate = useNavigate()

  return (
    <StaticPageLayout title="Yardım Merkezi" subtitle="Size nasıl yardımcı olabiliriz?">
      <div className="space-y-10">

        {/* Hızlı iletişim */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: 'mail', label: 'E-posta', sub: 'destek@gotur.com', action: () => window.open('mailto:destek@gotur.com') },
            { icon: 'call', label: 'Telefon', sub: '0850 123 45 67', action: () => window.open('tel:08501234567') },
            { icon: 'chat', label: 'Canlı Destek', sub: 'Haftaiçi 09:00–22:00', action: () => {} },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className="flex flex-col items-center gap-2 p-5 rounded-2xl border transition hover:shadow-md"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.sub}</span>
            </button>
          ))}
        </div>

        {/* SSS */}
        {FAQS.map(group => (
          <section key={group.cat}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>{group.icon}</span>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{group.cat}</h2>
            </div>
            <div className="space-y-2">
              {group.items.map((item, i) => {
                const key = `${group.cat}-${i}`
                const isOpen = openIdx === key
                return (
                  <div key={key} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    <button onClick={() => setOpenIdx(isOpen ? null : key)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left transition hover:opacity-80"
                      style={{ backgroundColor: 'var(--bg-card)' }}>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.q}</span>
                      <span className="material-symbols-outlined text-[20px] flex-shrink-0 transition-transform" style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 border-t" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-page)' }}>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.a}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {/* Ortak başvurusu CTA */}
        <div className="p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Restoran ortağı mısınız?</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Partner desteği için ayrı bir kanalımız var.</p>
          </div>
          <button onClick={() => navigate('/partner/apply')} className="flex-shrink-0 px-6 py-2.5 rounded-full text-sm font-bold text-white" style={{ backgroundColor: 'var(--accent)' }}>
            Ortak Desteği
          </button>
        </div>
      </div>
    </StaticPageLayout>
  )
}
