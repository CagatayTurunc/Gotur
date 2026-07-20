import { useState } from 'react'

// ── Veri ──────────────────────────────────────────────────────────────────────

interface HelpAnswer {
  title: string
  body: string
}

interface HelpQuestion {
  q: string
  answer: HelpAnswer
}

interface HelpCategory {
  icon: string
  label: string
  accent?: boolean
  questions: HelpQuestion[]
}

const HELP_DATA: HelpCategory[] = [
  {
    icon: 'person', label: 'Hesabım',
    questions: [
      {
        q: 'Telefon numaramı, adresimi veya diğer üyelik bilgilerimi güncellemek istiyorum.',
        answer: { title: 'Üyelik Bilgilerini Güncelle', body: 'Hesap Ayarları sayfasına giderek telefon numaranı, adresini ve diğer bilgilerini güncelleyebilirsin. Sağ üstteki profil menüsünden "Hesabım" seçeneğine tıkla.' },
      },
      {
        q: 'Farklı bir şehirden adres eklemek istiyorum.',
        answer: { title: 'Yeni Adres Ekle', body: 'Sipariş sırasında "Teslimat Adresi" bölümünden istediğin şehir ve ilçeyi seçerek yeni adres ekleyebilirsin. Türkiye\'nin tüm illerinde hizmet vermekteyiz.' },
      },
      {
        q: 'Şifremi değiştirmek istiyorum.',
        answer: { title: 'Şifre Değiştir', body: 'Hesap Ayarları → Şifre Değiştir bölümünden mevcut şifreni girerek yeni şifre belirleyebilirsin. Şifren en az 8 karakter içermelidir.' },
      },
      {
        q: 'Reklam içeren SMS ve e-posta almak istemiyorum.',
        answer: { title: 'Bildirim Tercihlerini Güncelle', body: 'Hesap Ayarları → Kampanya Tercihleri bölümünden e-posta ve SMS bildirimlerini kapatabilirsin.' },
      },
      {
        q: 'Götür\'e kayıtlı verilerim ve bu verilerin kullanımı ile ilgili bir sorum var.',
        answer: { title: 'Veri Gizliliği', body: 'Kişisel verilerinin nasıl işlendiğini öğrenmek için Gizlilik Politikamızı inceleyebilir ya da destek talebi oluşturabilirsin. KVKK kapsamında tüm verilerini görme, düzeltme veya silme hakkına sahipsin.' },
      },
      {
        q: 'Sipariş onay e-postalarını almak istemiyorum.',
        answer: { title: 'Sipariş Bildirimleri', body: 'Sipariş onay e-postaları hesap güvenliğin için zorunludur ve kapatılamaz. Ancak kampanya e-postalarını Hesap Ayarları\'ndan kapatabilirsin.' },
      },
    ],
  },
  {
    icon: 'shopping_bag', label: 'Siparişlerim',
    questions: [
      {
        q: 'Siparişim nerede, ne zaman gelecek?',
        answer: { title: 'Sipariş Takibi', body: 'Aktif siparişlerini "Önceki Siparişlerim" sayfasından ya da ana sayfadaki "Aktif Siparişin" panelinden canlı olarak takip edebilirsin. Kurye haritada gerçek zamanlı olarak gösterilir.' },
      },
      {
        q: 'Siparişimi iptal etmek istiyorum.',
        answer: { title: 'Sipariş İptali', body: 'Sipariş henüz "Bekliyor" aşamasındaysa iptal edebilirsin. Aktif siparişler sayfasından "Siparişi İptal Et" butonuna tıkla. Kurye atandıktan sonra iptal yapılamaz.' },
      },
      {
        q: 'Siparişimde eksik veya yanlış ürün var.',
        answer: { title: 'Eksik / Yanlış Ürün', body: 'Siparişin teslim edildikten sonra 30 dakika içinde destek talebi oluşturabilirsin. Fotoğraflı belgeleme sürecini hızlandırır. Haklı talepler için iade veya yeniden gönderim sağlanır.' },
      },
      {
        q: 'Siparişim çok geç geldi, soğuk/bozuk geldi.',
        answer: { title: 'Geç veya Hasarlı Teslimat', body: 'Teslimat süremizi aştık veya ürün hasarlı/soğuk geldiyse destek talebi oluştur. İnceleme sonucunda Götür Cüzdanına iade yapılabilir.' },
      },
      {
        q: 'Sipariş geçmişimi görmek istiyorum.',
        answer: { title: 'Sipariş Geçmişi', body: 'Profil menüsünden "Önceki Siparişlerim" sayfasına giderek tüm sipariş geçmişini, tutarlarını ve durumlarını görebilirsin.' },
      },
    ],
  },
  {
    icon: 'payments', label: 'Ödeme',
    questions: [
      {
        q: 'Ödeme yöntemimi nasıl değiştiririm?',
        answer: { title: 'Ödeme Yöntemi Değiştir', body: 'Ödeme sayfasında Kredi/Banka Kartı, Götür Cüzdanı veya Kapıda Ödeme seçeneklerinden birini seçebilirsin. Her sipariş için farklı ödeme yöntemi kullanabilirsin.' },
      },
      {
        q: 'Kartım neden kabul edilmedi?',
        answer: { title: 'Kart Kabul Edilmedi', body: 'Kartın bilgilerini kontrol et (numara, son kullanma tarihi, CVV). Bankanın online alışverişlere izin verdiğinden emin ol. Sorun devam ederse bankanı ara veya farklı kart dene.' },
      },
      {
        q: 'Ücret iade talebim var.',
        answer: { title: 'Ücret İadesi', body: 'İade talepleri genellikle 3-5 iş günü içinde kartına yansır. Acele iadeler için Götür Cüzdanına anında yükleme yapabiliriz. Destek talebi oluşturarak başvurabilirsin.' },
      },
      {
        q: 'Faturamı nasıl alabilirim?',
        answer: { title: 'Fatura', body: 'Sipariş onayından sonra kayıtlı e-posta adresine fatura gönderilir. Kurumsal fatura için sipariş sırasında şirket bilgilerini girmen gerekir.' },
      },
    ],
  },
  {
    icon: 'confirmation_number', label: 'Joker ve Kupon',
    questions: [
      {
        q: 'Kuponum uygulanmıyor, neden?',
        answer: { title: 'Kupon Uygulanmıyor', body: 'Kuponun geçerlilik tarihini, minimum sepet tutarını ve hangi restoranlar için geçerli olduğunu kontrol et. Bazı kuponlar belirli kategoriler veya ilk sipariş için geçerlidir.' },
      },
      {
        q: 'Kuponumu nasıl kullanabilirim?',
        answer: { title: 'Kupon Kullanımı', body: 'Ödeme sayfasında "Kupon / Promosyon Kodu" alanına kupon kodunu gir ve uygula. İndirim tutarı otomatik olarak sepet toplamından düşülür.' },
      },
      {
        q: 'Joker kodum var, nasıl kullanırım?',
        answer: { title: 'Joker Kodu', body: 'Joker kodları Götür uygulamasında özel kampanyalar kapsamında dağıtılır. Ödeme ekranında kupon kodu gibi kullanabilirsin.' },
      },
    ],
  },
  {
    icon: 'workspace_premium', label: 'GöPro', accent: true,
    questions: [
      {
        q: 'GöPro nedir, ne avantajı var?',
        answer: { title: 'GöPro Avantajları', body: 'GöPro üyeliği ile tüm siparişlerde ücretsiz teslimat, öncelikli destek ve özel indirimler kazanırsın. Aylık ve yıllık abonelik seçenekleri mevcuttur.' },
      },
      {
        q: 'GöPro aboneliğimi nasıl iptal ederim?',
        answer: { title: 'GöPro İptali', body: 'Hesap Ayarları → Aboneliklerim bölümünden GöPro aboneliğini dilediğin zaman iptal edebilirsin. İptal, mevcut dönem sonunda geçerli olur.' },
      },
      {
        q: 'GöPro ücretsiz teslimat nasıl çalışır?',
        answer: { title: 'Ücretsiz Teslimat', body: 'GöPro üyeliği aktifken 75₺ ve üzeri tüm siparişlerde teslimat ücreti alınmaz. Anlaşmalı restoranlar için geçerlidir.' },
      },
    ],
  },
  {
    icon: 'stars', label: 'GöClub', accent: true,
    questions: [
      {
        q: 'GöClub puanlarımı nasıl kullanabilirim?',
        answer: { title: 'GöClub Puan Kullanımı', body: 'Biriken puanları ödeme sayfasında indirim olarak kullanabilirsin. 100 puan = 1₺ indirim değerindedir. Minimum 500 puan ile kullanım başlar.' },
      },
      {
        q: 'Neden puan kazanamıyorum?',
        answer: { title: 'Puan Kazanamıyorum', body: 'Puan kazanmak için siparişinin GöClub anlaşmalı bir restorandan verilmesi gerekir. İptal edilen siparişler için puan yüklenmez.' },
      },
      {
        q: 'Puanlarımın son kullanma tarihi var mı?',
        answer: { title: 'Puan Geçerlilik Süresi', body: 'Kazandığın puanlar 12 ay içinde kullanılmazsa otomatik olarak silinir. Puanlarının geçerlilik tarihini profil sayfandan kontrol edebilirsin.' },
      },
    ],
  },
  {
    icon: 'mail', label: 'Taleplerim',
    questions: [
      {
        q: 'Önceki destek taleplerime nasıl ulaşabilirim?',
        answer: { title: 'Destek Talepleri', body: 'Daha önce oluşturduğun destek taleplerini bu bölümden görüntüleyebilirsin. Açık talepler güncelleme geldiğinde e-posta ile bildirim alırsın.' },
      },
      {
        q: 'Talebim ne zaman cevaplanacak?',
        answer: { title: 'Yanıt Süresi', body: 'Normal talepler 24 saat içinde, acil talepler (siparişle ilgili) 2 saat içinde yanıtlanır. Canlı destek seçeneğiyle anında yardım alabilirsin.' },
      },
      {
        q: 'Talebimi yeniden açmak istiyorum.',
        answer: { title: 'Talep Yeniden Açma', body: 'Kapanan bir talep için aynı konuda yeni talep oluşturabilir, önceki talep numarasını referans olarak belirtebilirsin.' },
      },
    ],
  },
]

// ── Bileşen ───────────────────────────────────────────────────────────────────

interface HelpDrawerProps {
  onClose: () => void
  helpSearch: string
  setHelpSearch: (v: string) => void
}

type View =
  | { type: 'home' }
  | { type: 'category'; cat: HelpCategory }
  | { type: 'answer'; cat: HelpCategory; item: HelpQuestion }

export default function HelpDrawer({ onClose, helpSearch, setHelpSearch }: HelpDrawerProps) {
  const [view, setView] = useState<View>({ type: 'home' })

  const goHome = () => { setView({ type: 'home' }); setHelpSearch('') }

  // Header title ve geri butonu
  const headerTitle =
    view.type === 'home'     ? 'Yardım Merkezi' :
    view.type === 'category' ? view.cat.label    :
                               view.cat.label

  const canGoBack = view.type !== 'home'

  const handleBack = () => {
    if (view.type === 'answer') setView({ type: 'category', cat: view.cat })
    else goHome()
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full w-full md:w-96 bg-white z-[70] flex flex-col shadow-2xl"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 bg-[#9a0002] text-white flex-shrink-0">
          {canGoBack ? (
            <button
              onClick={handleBack}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          ) : (
            <span className="material-symbols-outlined text-[22px] flex-shrink-0">support_agent</span>
          )}
          <h2 className="text-base font-black flex-1 truncate">{headerTitle}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* İçerik — view'e göre */}
        <div className="flex-1 overflow-y-auto">
          {view.type === 'home' && (
            <HomeView
              search={helpSearch}
              setSearch={setHelpSearch}
              onSelectCat={cat => setView({ type: 'category', cat })}
            />
          )}
          {view.type === 'category' && (
            <CategoryView
              cat={view.cat}
              onSelectQ={item => setView({ type: 'answer', cat: view.cat, item })}
            />
          )}
          {view.type === 'answer' && (
            <AnswerView item={view.item} />
          )}
        </div>
      </div>
    </>
  )
}

// ── Alt görünümler ────────────────────────────────────────────────────────────

function HomeView({ search, setSearch, onSelectCat }: {
  search: string
  setSearch: (v: string) => void
  onSelectCat: (cat: HelpCategory) => void
}) {
  const filtered = HELP_DATA.filter(c =>
    !search || c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.questions.some(q => q.q.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <>
      {/* Üst alan */}
      <div className="px-5 pt-5 pb-4 bg-[#fff8f6] border-b border-[#f0e0dd]">
        <p className="text-sm font-bold text-[#271815] mb-3">Nasıl yardımcı olabiliriz?</p>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#8f706b]">search</span>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Yardım ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e4beb8] bg-white text-sm text-[#271815] focus:outline-none focus:ring-2 focus:ring-[#9a0002]/20 focus:border-[#9a0002] transition placeholder-[#b09090]"
          />
        </div>
      </div>

      {/* Kategoriler */}
      <div className="px-4 py-3">
        <p className="text-[11px] font-bold text-[#8f706b] uppercase tracking-widest px-1 mb-2">Kategoriler</p>
        <div className="space-y-0.5">
          {filtered.map(cat => (
            <button
              key={cat.label}
              onClick={() => onSelectCat(cat)}
              className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-[#fff0ee] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#fff0ee] flex items-center justify-center flex-shrink-0 group-hover:bg-[#ffdad5] transition-colors">
                  <span className="material-symbols-outlined text-[20px]" style={{ color: cat.accent ? '#9a0002' : '#8f706b' }}>{cat.icon}</span>
                </div>
                <span className="text-sm font-semibold text-[#271815]">{cat.label}</span>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#c0a09a] group-hover:text-[#9a0002] transition-colors">chevron_right</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sık Sorulanlar */}
      <div className="px-4 pb-4">
        <p className="text-[11px] font-bold text-[#8f706b] uppercase tracking-widest px-1 mb-2">Sık Sorulanlar</p>
        <div className="space-y-2">
          {HELP_DATA.flatMap(c => c.questions).slice(0, 4).map(q => (
            <button key={q.q}
              onClick={() => {
                const cat = HELP_DATA.find(c => c.questions.includes(q))!
                onSelectCat(cat)
              }}
              className="w-full text-left px-4 py-3 rounded-xl bg-[#fff8f6] border border-[#f0e0dd] text-sm text-[#5b403c] hover:border-[#9a0002]/30 hover:bg-[#fff0ee] transition-all flex items-center justify-between gap-2"
            >
              <span className="line-clamp-2">{q.q}</span>
              <span className="material-symbols-outlined text-[16px] text-[#c0a09a] flex-shrink-0">arrow_forward</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canlı Destek */}
      <div className="px-4 pb-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#9a0002] to-[#6f0001] p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">headset_mic</span>
            </div>
            <div>
              <p className="font-bold text-sm">Canlı Destek</p>
              <p className="text-xs text-white/70">7/24 hizmetinizdeyiz</p>
            </div>
          </div>
          <button className="w-full py-2.5 rounded-full bg-white text-[#9a0002] text-sm font-bold hover:bg-white/90 transition-colors">
            Destek Talebi Oluştur
          </button>
        </div>
      </div>
    </>
  )
}

function CategoryView({ cat, onSelectQ }: {
  cat: HelpCategory
  onSelectQ: (item: HelpQuestion) => void
}) {
  return (
    <div className="py-2">
      {cat.questions.map((item, i) => (
        <button
          key={i}
          onClick={() => onSelectQ(item)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#fff0ee] transition-colors group border-b border-[#f9dcd7] last:border-0 text-left gap-3"
        >
          <span className="text-sm text-[#271815] leading-snug flex-1">{item.q}</span>
          <span className="material-symbols-outlined text-[20px] text-[#c0a09a] group-hover:text-[#9a0002] transition-colors flex-shrink-0">chevron_right</span>
        </button>
      ))}
    </div>
  )
}

function AnswerView({ item }: { item: HelpQuestion }) {
  const [sent, setSent] = useState(false)
  return (
    <div className="px-5 py-6 space-y-5">
      {/* Başlık */}
      <h3 className="text-base font-black text-[#271815]">{item.answer.title}</h3>

      {/* Cevap metni */}
      <div className="bg-[#fff8f6] rounded-2xl p-4 border border-[#f0e0dd]">
        <p className="text-sm text-[#5b403c] leading-relaxed">{item.answer.body}</p>
      </div>

      {/* Faydalı mı? */}
      {!sent ? (
        <div className="rounded-2xl border border-[#f0e0dd] p-4">
          <p className="text-sm font-semibold text-[#271815] mb-3 text-center">Bu yanıt işine yaradı mı?</p>
          <div className="flex gap-3">
            <button onClick={() => setSent(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full border-2 border-[#9a0002] text-[#9a0002] text-sm font-bold hover:bg-[#9a0002] hover:text-white transition-all">
              <span className="material-symbols-outlined text-[18px]">thumb_up</span> Evet
            </button>
            <button onClick={() => setSent(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full border-2 border-[#e4beb8] text-[#8f706b] text-sm font-bold hover:bg-[#fff0ee] transition-all">
              <span className="material-symbols-outlined text-[18px]">thumb_down</span> Hayır
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-green-50 border border-green-200 text-green-700 text-sm">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          Geri bildiriminiz için teşekkürler!
        </div>
      )}

      {/* Hâlâ yardım lazım */}
      <div className="rounded-2xl bg-gradient-to-br from-[#9a0002] to-[#6f0001] p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">headset_mic</span>
          </div>
          <div>
            <p className="font-bold text-sm">Hâlâ yardıma mı ihtiyacın var?</p>
            <p className="text-xs text-white/70">7/24 destekteyiz</p>
          </div>
        </div>
        <button className="w-full py-2.5 rounded-full bg-white text-[#9a0002] text-sm font-bold hover:bg-white/90 transition-colors">
          Destek Talebi Oluştur
        </button>
      </div>
    </div>
  )
}
