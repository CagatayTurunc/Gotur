import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'

export default function Navbar() {
  const navigate = useNavigate()
  const user = authService.getUser()

  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    setOpen(false)
    authService.logout()
    navigate('/login')
  }

  // Dışarı tıklayınca kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const roleLabel: Record<string, string> = {
    customer: 'Müşteri',
    courier: 'Kurye',
    admin: 'Admin',
    restaurant: 'Restoran',
  }

  const roleIcon: Record<string, string> = {
    customer: '🛒',
    courier: '🛵',
    admin: '⚙️',
    restaurant: '🍽️',
  }

  const menuItems = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-yellow-500">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
      ),
      label: 'Cüzdan',
      onClick: () => { setOpen(false); navigate('/wallet') }
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-gray-500">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
        </svg>
      ),
      label: 'Önceki Siparişlerim',
      onClick: () => { setOpen(false); navigate('/orders') }
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-gray-500">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      ),
      label: 'Hesabım',
      onClick: () => { setOpen(false); navigate('/account') }
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-gray-500">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      label: 'Yardım Merkezi',
      onClick: () => setOpen(false)
    },
  ]

  return (
    <header className="bg-[#9a0002] shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-white font-black text-xl tracking-tight"
        >
          🛵 Götür
        </button>

        {user && (
          <div className="relative" ref={menuRef}>
            {/* Kullanıcı adı butonu */}
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-2 text-white hover:text-white/80 transition-colors select-none"
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold hidden sm:block">{user.fullName}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/20 hidden sm:block">
                {roleLabel[user.role] ?? user.role}
              </span>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Overlay — arka planı karartır */}
            {open && (
              <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setOpen(false)}
              />
            )}

            {/* Dropdown menü */}
            {open && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] z-50 overflow-hidden
                animate-[dropIn_0.18s_ease-out]">

                {/* Kullanıcı bilgisi */}
                <div className="px-4 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#9a0002] flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{user.fullName}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#9a0002] text-white text-xs font-semibold">
                    <span>{roleIcon[user.role] ?? '👤'}</span>
                    <span>{roleLabel[user.role] ?? user.role}</span>
                  </div>
                </div>

                {/* Menü öğeleri */}
                <ul className="py-1.5">
                  {menuItems.map((item) => (
                    <li key={item.label}>
                      <button
                        onClick={item.onClick}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                      >
                        <span className="flex-shrink-0 flex items-center justify-center w-5">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Çıkış yap — ayırıcıyla */}
                <div className="border-t border-gray-100 py-1.5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors text-left font-medium"
                  >
                    <span className="flex-shrink-0 flex items-center justify-center w-5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                    </span>
                    <span>Çıkış yap</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </header>
  )
}
