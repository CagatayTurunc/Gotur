import { useState } from 'react'
import StaticPageLayout from '../components/StaticPageLayout'

export default function DataRequestPage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', type: 'access', detail: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <StaticPageLayout
      title="Kişisel Veri Talebi"
      subtitle="KVKK kapsamındaki haklarınızı kullanmak için başvurun">
      <div className="max-w-2xl space-y-8">

        {submitted ? (
          <div className="flex flex-col items-center text-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e6f4ea' }}>
              <span className="material-symbols-outlined text-[32px]" style={{ color: '#137333', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Talebiniz Alındı</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Başvurunuz 30 gün içinde <strong>{form.email}</strong> adresinize yanıtlanacaktır.
            </p>
            <button onClick={() => setSubmitted(false)} className="mt-4 text-sm font-semibold underline" style={{ color: 'var(--accent)' }}>
              Yeni başvuru yap
            </button>
          </div>
        ) : (
          <>
            <div className="p-5 rounded-xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                6698 Sayılı KVKK kapsamındaki haklarınızı kullanmak için aşağıdaki formu doldurun.
                Başvurular kimlik doğrulama sonrası <strong>30 gün içinde</strong> yanıtlanır.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Ad Soyad *</label>
                <input required type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Adınız Soyadınız"
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>E-posta *</label>
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="kayıtlı@eposta.com"
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Talep Türü *</label>
                <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  <option value="access">Verilerimin bir kopyasını istiyorum</option>
                  <option value="delete">Hesabımı ve verilerimi silmek istiyorum</option>
                  <option value="correct">Verilerimin düzeltilmesini istiyorum</option>
                  <option value="object">Veri işlemeye itiraz ediyorum</option>
                  <option value="portability">Verilerimi taşınabilir biçimde istiyorum</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Açıklama</label>
                <textarea value={form.detail} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} rows={4}
                  placeholder="Talebinizle ilgili ek bilgi..."
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none resize-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              </div>
              <button type="submit"
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition hover:opacity-85"
                style={{ backgroundColor: 'var(--accent)' }}>
                Talebi Gönder
              </button>
            </form>
          </>
        )}
      </div>
    </StaticPageLayout>
  )
}
