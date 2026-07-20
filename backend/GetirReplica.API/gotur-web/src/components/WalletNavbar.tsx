import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: "'FILL' 0" }}
    >
      {name}
    </span>
  )
}

export default function WalletNavbar({ activePage = 'wallet' }: { activePage?: 'wallet' | 'orders' | 'account' }) {
  const navigate = useNavigate()
  const user = authService.getUser()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    setOpen(false)
    authService.logout()
    navigate('/login')
  }

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

  const menuItems = [
    {
      icon: 'account_balance_wallet',
      label: 'Cüzdan',
      onClick: () => { setOpen(false); navigate('/wallet') },
      active: activePage === 'wallet',
    },
    {
      icon: 'receipt_long',
      label: 'Önceki Siparişlerim',
      onClick: () => { setOpen(false); navigate('/orders') },
      active: activePage === 'orders',
    },
    {
      icon: 'person',
      label: 'Hesabım',
      onClick: () => { setOpen(false); navigate('/account') },
      active: activePage === 'account',
    },
    {
      icon: 'redeem',
      label: 'Kuponlarım',
      onClick: () => setOpen(false),
      active: false,
    },
    {
      icon: 'help',
      label: 'Yardım Merkezi',
      onClick: () => setOpen(false),
      active: false,
    },
  ]

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">

        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="text-[#9a0002] font-black text-2xl italic tracking-tight hover:opacity-80 transition-opacity"
        >
          Götür
        </button>

        {/* Right side */}
        {user && (
          <div className="relative flex items-center gap-3" ref={menuRef}>

            {/* User button */}
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors select-none"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-[#9a0002] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-gray-800 hidden sm:block">
                {user.fullName.split(' ')[0]}
              </span>
              {/* Role badge */}
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-[#9a0002] text-[11px] font-semibold">
                {roleLabel[user.role] ?? user.role}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Overlay */}
            {open && (
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            )}

            {/* Dropdown */}
            {open && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 z-50 overflow-hidden animate-[navDrop_0.16s_ease-out]">

                {/* User header */}
                <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#9a0002] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">{user.fullName}</p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  <span className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-[#9a0002] text-[11px] font-semibold">
                    {roleLabel[user.role] ?? user.role}
                  </span>
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  {menuItems.map(item => (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors text-left group ${
                        item.active
                          ? 'bg-red-50 text-[#9a0002] font-semibold'
                          : 'text-gray-700 hover:bg-gray-50 font-normal'
                      }`}
                    >
                      <Icon
                        name={item.icon}
                        className={`text-[18px] ${item.active ? 'text-[#9a0002]' : 'text-gray-400 group-hover:text-gray-600'} transition-colors`}
                      />
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Logout */}
                <div className="border-t border-gray-100 py-1.5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#9a0002] hover:bg-red-50 transition-colors text-left font-medium group"
                  >
                    <Icon name="logout" className="text-[18px] text-[#9a0002]" />
                    Çıkış yap
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes navDrop {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </header>
  )
}
