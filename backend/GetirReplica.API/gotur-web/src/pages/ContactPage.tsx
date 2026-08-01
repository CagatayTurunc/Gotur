import { useState } from 'react'
import StaticPageLayout from '../components/StaticPageLayout'

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', subject: 'siparis', message: '' })

  return (
    <StaticPageLayout title="İletişim" subtitle="Sorularınız için buradayız">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

        {/* Sol — İletişim bilgileri */}
        <div className="space-y-5">
          {[
            { icon: 'mail', label: 'E-posta', value: 'destek@gotur.com', href: 'mailto:destek@gotur.com' },
            { icon: 'call', label: 'Telefon', value: '0850 123 45 67', href: 'tel:08501234567' },
            { icon: 'schedule', label: 'Çalışma Saatleri', value: 'Haftaiçi 09:00 – 22:00\nHafta sonu 10:00 – 20:00', href: null },
            { icon: 'location_on', label: 'Adres', value: 'Mustafa Kemal Mah. Çankaya / Ankara', href: null },
          ].map(item => (
            <div key={item.label} className="flex gap-3 p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <span className="material-symbols-outlined text-[22px] flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                {item.href ? (
                  <a href={item.href} className="text-sm font-medium hover:opacity-70" style={{ color: 'var(--text-primary)' }}>{item.value}</a>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{item.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Sağ — Form */}
        <div className="md:col-span-2">
          {sent ? (
            <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
              <span className="material-symbols-outlined text-[56px]" style={{ color: '#137333', fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Mesajınız iletildi!</h3>
              <p style={{ color: 'var(--text-secondary)' }}>En geç 24 saat içinde <strong>{form.email}</strong> adresinize dönüş yapacağız.</p>
              <button onClick={() => setSent(false)} className="mt-2 text-sm font-semibold underline" style={{ color: 'var(--accent)' }}>Yeni mesaj gönder</button>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); setSent(true) }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Ad Soyad *</label>
                  <input required type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Adınız Soyadınız"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>E-posta *</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@ornek.com"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Konu *</label>
                <select required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  <option value="siparis">Sipariş ile ilgili</option>
                  <option value="odeme">Ödeme ve fatura</option>
                  <option value="hesap">Hesap ve güvenlik</option>
                  <option value="ortak">Restoran ortaklığı</option>
                  <option value="kurye">Kurye başvurusu</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Mesajınız *</label>
                <textarea required value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={5}
                  placeholder="Bize iletmek istediğiniz her şeyi yazabilirsiniz..."
                  className="w-full border rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              </div>
              <button type="submit" className="w-full py-3.5 rounded-xl font-bold text-sm text-white hover:opacity-85 transition"
                style={{ backgroundColor: 'var(--accent)' }}>
                Mesajı Gönder
              </button>
            </form>
          )}
        </div>
      </div>
    </StaticPageLayout>
  )
}
