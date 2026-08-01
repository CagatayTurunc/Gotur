import { useNavigate } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

interface Props {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function StaticPageLayout({ title, subtitle, children }: Props) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      {/* Minimal header */}
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-2xl font-black italic tracking-tight" style={{ color: 'var(--accent)' }}>
            Götür
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-sm font-medium hover:opacity-70 transition-opacity flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Geri
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-10">
          <h1 className="text-3xl md:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          {subtitle && <p className="mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 md:px-8 py-10">
        {children}
      </main>

      {/* Mini footer */}
      <div className="border-t mt-16 py-6 text-center text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} Götür Teknoloji A.Ş. Tüm hakları saklıdır.
      </div>
    </div>
  )
}
