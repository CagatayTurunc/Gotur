import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
      className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6f0001] ${
        theme === 'dark' ? 'bg-[#6f0001]' : 'bg-[#e4beb8]'
      } ${className}`}
    >
      {/* Track icons */}
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[14px] select-none">☀️</span>
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[14px] select-none">🌙</span>
      {/* Thumb */}
      <span
        className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
          theme === 'dark' ? 'translate-x-7' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
