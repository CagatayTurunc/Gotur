import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WalletNavbar from '../components/WalletNavbar'
import { authService } from '../services/authService'

interface Transaction {
  id: number
  type: 'payment' | 'topup' | 'cashback' | 'refund'
  label: string
  date: string
  amount: number
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 1, type: 'payment',  label: 'Sipariş Ödemesi',    date: 'Bugün, 14:30',    amount: -120.50 },
  { id: 2, type: 'topup',    label: 'Bakiye Yükleme',     date: 'Dün, 09:15',      amount:  300.00 },
  { id: 3, type: 'cashback', label: 'Cüzdan Para Kazandı', date: 'Eki 24, 19:45',  amount:   15.00 },
  { id: 4, type: 'payment',  label: 'Sipariş Ödemesi',    date: 'Eki 23, 13:20',   amount:  -89.90 },
  { id: 5, type: 'refund',   label: 'İade Alındı',        date: 'Eki 20, 11:05',   amount:   45.00 },
  { id: 6, type: 'payment',  label: 'Sipariş Ödemesi',    date: 'Eki 18, 20:00',   amount:  -55.00 },
]

const SAVED_CARDS = [
  { id: 1, bank: 'Garanti Bankası', last4: '4242' },
  { id: 2, bank: 'Enpara',          last4: '1234' },
]

const TOP_UP_AMOUNTS = [50, 100, 200, 500]

// Material icon name per transaction type — matches reference design
const TX_ICON: Record<Transaction['type'], string> = {
  payment:  'restaurant',
  topup:    'add',
  cashback: 'redeem',
  refund:   'currency_exchange',
}

function Icon({ name, filled = false, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
    >
      {name}
    </span>
  )
}

export default function WalletPage() {
  const navigate = useNavigate()
  const user = authService.getUser()
  const [showTopUp, setShowTopUp] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [balance, setBalance] = useState(245.50)
  const [bonusBalance] = useState(15.00)
  const [toastMsg, setToastMsg] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS)

  if (!user) { navigate('/login'); return null }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  const handleTopUp = () => {
    const amount = selectedAmount !== null ? selectedAmount : parseFloat(customAmount)
    if (!amount || amount <= 0) return
    setBalance(prev => prev + amount)
    setTransactions(prev => [
      { id: Date.now(), type: 'topup', label: 'Bakiye Yükleme', date: 'Az önce', amount },
      ...prev,
    ])
    setShowTopUp(false)
    setSelectedAmount(null)
    setCustomAmount('')
    showToast(`₺${amount.toFixed(2)} bakiye yüklendi!`)
  }

  const intPart = Math.floor(balance).toString()
  const decPart = (balance % 1).toFixed(2).slice(1)

  return (
    <div className="min-h-screen bg-[#fff8f6]">
      <WalletNavbar />

      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#9a0002] text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold animate-[toastIn_0.2s_ease-out]">
          <div className="flex items-center gap-2">
            <Icon name="check_circle" filled className="text-[18px]" />
            {toastMsg}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 pb-28">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-black text-[#9a0002]">Götür Cüzdan</h1>
          <p className="text-sm text-[#8f706b] mt-1">Bakiyeni yönet, ödeme yöntemlerini düzenle.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-1 space-y-5">

            {/* Balance Card */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_4px_12px_rgba(32,16,0,0.07)] relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#ffe9e6] rounded-full opacity-60" />
              <div className="absolute -right-4 -bottom-8 w-24 h-24 bg-[#ffdad5] rounded-full opacity-40" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-[#8f706b] mb-2">
                  <Icon name="account_balance_wallet" filled className="text-[20px] text-[#9a0002]" />
                  <span className="text-xs font-bold uppercase tracking-widest">Toplam Bakiye</span>
                </div>
                <div className="text-5xl font-black text-[#271815] mb-1 leading-none">
                  ₺{intPart}
                  <span className="text-2xl font-semibold text-[#8f706b]">{decPart}</span>
                </div>
                <p className="text-sm text-[#9a0002] font-semibold mb-6">+ ₺{bonusBalance.toFixed(2)} Cüzdan Para</p>
                <button
                  onClick={() => setShowTopUp(true)}
                  className="w-full bg-[#9a0002] hover:bg-[#6f0001] text-white font-bold py-3.5 rounded-full shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                >
                  <Icon name="add_circle" className="text-[20px]" />
                  Bakiye Yükle
                </button>
              </div>
            </div>

            {/* Saved Cards */}
            <div className="bg-white rounded-2xl p-5 shadow-[0_4px_12px_rgba(32,16,0,0.07)]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-[#271815] text-base">Kayıtlı Kartlar</h3>
                <button className="text-[#9a0002] text-xs font-bold flex items-center gap-0.5 hover:underline">
                  <Icon name="add" className="text-[16px]" /> Ekle
                </button>
              </div>
              <div className="space-y-2">
                {SAVED_CARDS.map(card => (
                  <div
                    key={card.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#fff0ee] transition-colors cursor-pointer border border-transparent hover:border-[#e4beb8]"
                  >
                    <div className="w-11 h-8 bg-[#f9dcd7] rounded-lg flex items-center justify-center">
                      <Icon name="credit_card" className="text-[20px] text-[#8f706b]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#271815]">{card.bank}</p>
                      <p className="text-xs text-[#8f706b]">**** {card.last4}</p>
                    </div>
                    <Icon name="more_vert" className="text-[20px] text-[#8f706b]" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Feature Banner */}
            <div
              className="rounded-2xl overflow-hidden relative shadow-[0_4px_12px_rgba(32,16,0,0.07)] h-48 md:h-56 bg-cover bg-center"
              style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCfJnX5ibzZZZFmwiTMzrjZ1UigHfLRgUc58ppORtucXeNEZb2XImJEexQGLdxufwKEK_zOIrw1y511MVLbjBU1YUIkkMh8Zi8ZHuRtP4JBipy_RcD4WZFBaEpIUdrTsUH5hCQUtQv6M7QZ8kpIj2unCk580y2oa_qewo36qcOYU2V9UxF37atrK7Hmgh1Ycty451ID5iHfdTNUxx1INo776ptW_rqXOt4AkySybm3QV2kxMGbARhTBEyN1GjvoAOM21zcSB1tItHc')" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#1a0a08]/85 to-transparent flex flex-col justify-center px-6">
                <h2 className="text-xl md:text-2xl font-black text-white mb-1">Götür Cüzdan Neden?</h2>
                <p className="text-sm text-white/75 max-w-xs">Hızlı, güvenli ve ödüllendirici. Tüm siparişlerinde kesintisiz ödeme.</p>
              </div>
            </div>

            {/* Features Grid — icons match reference exactly */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: 'currency_exchange', filled: true,  title: 'Anında İade',    desc: 'İadeler anında cüzdanına yüklenir.' },
                { icon: 'move_up',           filled: true,  title: 'İade Transferi', desc: 'İadeleri istediğin zaman kartına aktar.' },
                { icon: 'loyalty',           filled: true,  title: 'Cüzdan Para',    desc: 'Sipariş başına puan ve nakit para kazan.' },
                { icon: 'bolt',              filled: true,  title: 'Kolay Ödeme',    desc: 'Kasada tek tıkla ödeme kolaylığı.' },
              ].map(f => (
                <div
                  key={f.title}
                  className="bg-white p-4 rounded-xl shadow-[0_4px_12px_rgba(32,16,0,0.05)] flex items-start gap-3 hover:-translate-y-0.5 transition-transform duration-200"
                >
                  <div className="bg-[#fff0ee] p-2 rounded-lg flex-shrink-0">
                    <Icon name={f.icon} filled={f.filled} className="text-[22px] text-[#9a0002]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#271815]">{f.title}</h4>
                    <p className="text-xs text-[#8f706b] mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Transaction History */}
            <div className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(32,16,0,0.07)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f9dcd7] flex justify-between items-center">
                <h3 className="font-bold text-[#271815]">Son İşlemler</h3>
                <button className="text-[#9a0002] text-xs font-bold hover:underline">Tümünü Gör</button>
              </div>
              <div className="divide-y divide-[#fff0ee]">
                {transactions.slice(0, 6).map(tx => (
                  <div
                    key={tx.id}
                    className="px-5 py-4 flex items-center justify-between hover:bg-[#fff8f6] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#fff0ee] flex items-center justify-center flex-shrink-0">
                        <Icon name={TX_ICON[tx.type]} className="text-[20px] text-[#9a0002]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#271815]">{tx.label}</p>
                        <p className="text-xs text-[#8f706b]">{tx.date}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${tx.amount < 0 ? 'text-[#271815]' : 'text-[#9a0002]'}`}>
                      {tx.amount < 0 ? '− ' : '+ '}₺{Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Top-Up Modal */}
      {showTopUp && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowTopUp(false)} />
          <div className="fixed inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 w-full md:w-96 bg-white rounded-t-2xl md:rounded-2xl shadow-2xl p-6 animate-[slideUp_0.25s_ease-out]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-[#9a0002] text-lg">Bakiye Yükle</h3>
              <button
                onClick={() => setShowTopUp(false)}
                className="w-8 h-8 rounded-full bg-[#fff0ee] flex items-center justify-center text-[#9a0002] hover:bg-[#ffdad5] transition"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            <p className="text-xs text-[#8f706b] font-semibold uppercase tracking-wide mb-3">Hızlı Seçim</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {TOP_UP_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => { setSelectedAmount(amt); setCustomAmount('') }}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition ${
                    selectedAmount === amt
                      ? 'bg-[#9a0002] text-white border-[#9a0002]'
                      : 'bg-[#fff8f6] text-[#271815] border-[#e4beb8] hover:border-[#9a0002]'
                  }`}
                >
                  ₺{amt}
                </button>
              ))}
            </div>

            <p className="text-xs text-[#8f706b] font-semibold uppercase tracking-wide mb-2">Diğer Tutar</p>
            <div className="relative mb-5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8f706b] font-bold text-sm">₺</span>
              <input
                type="number"
                min="1"
                value={customAmount}
                onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(null) }}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-[#e4beb8] bg-[#fff8f6] text-[#271815] font-semibold focus:outline-none focus:border-[#9a0002] focus:ring-2 focus:ring-[#9a0002]/20 transition"
              />
            </div>

            <p className="text-xs text-[#8f706b] font-semibold uppercase tracking-wide mb-2">Kart Seç</p>
            <div className="space-y-2 mb-5">
              {SAVED_CARDS.map(card => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 p-3 rounded-xl border-2 border-[#e4beb8] hover:border-[#9a0002] cursor-pointer transition"
                >
                  <Icon name="credit_card" className="text-[22px] text-[#8f706b]" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[#271815]">{card.bank}</p>
                    <p className="text-xs text-[#8f706b]">**** {card.last4}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleTopUp}
              disabled={!selectedAmount && !customAmount}
              className="w-full bg-[#9a0002] hover:bg-[#6f0001] disabled:bg-[#e4beb8] text-white font-black py-4 rounded-full transition-all text-sm active:scale-[0.98]"
            >
              {(selectedAmount !== null || customAmount)
                ? `₺${((selectedAmount !== null ? selectedAmount : parseFloat(customAmount)) || 0).toFixed(2)} Yükle`
                : 'Tutar Seçin'}
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
