import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { useEffect, useState } from 'react'
import { authService } from './services/authService'
import { ThemeProvider } from './context/ThemeContext'
import { AddressProvider } from './context/AddressContext'
import AddressPickerModal from './components/AddressPickerModal'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RestaurantDetailPage from './pages/RestaurantDetailPage'
import CheckoutPage from './pages/CheckoutPage'
import TrackingPage from './pages/TrackingPage'
import AdminPage from './pages/AdminPage'
import RestaurantPage from './pages/RestaurantPage'
import CourierPage from './pages/CourierPage'
import WalletPage from './pages/WalletPage'
import OrdersPage from './pages/OrdersPage'
import AccountPage from './pages/AccountPage'
import PartnerApplyPage from './pages/PartnerApplyPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import KvkkPage from './pages/KvkkPage'
import CookiePolicyPage from './pages/CookiePolicyPage'
import InfoSocietyPage from './pages/InfoSocietyPage'
import DataRequestPage from './pages/DataRequestPage'
import HelpPage from './pages/HelpPage'
import FaqPage from './pages/FaqPage'
import ContactPage from './pages/ContactPage'
import OrderTrackingInfoPage from './pages/OrderTrackingInfoPage'
import DownloadAppPage from './pages/DownloadAppPage'

// Giriş yapılmamışsa login'e yönlendir
function PrivateRoute({ children }: { children: React.ReactNode }) {
  if (!authService.isLoggedIn()) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Role göre yönlendirme — müşteri ve ziyaretçi anasayfaya gider
function HomeRedirect() {
  const user = authService.getUser()
  if (!user) return <HomePage />
  switch (user.role) {
    case 'admin':      return <Navigate to="/admin" replace />
    case 'restaurant': return <Navigate to="/restaurant" replace />
    case 'courier':    return <Navigate to="/courier" replace />
    default:           return <HomePage />
  }
}

// Login sayfası — zaten giriş yapmışsa role'e göre yönlendir
function LoginRoute() {
  const user = authService.getUser()
  if (!user) return <LoginPage />
  switch (user.role) {
    case 'admin':      return <Navigate to="/admin" replace />
    case 'restaurant': return <Navigate to="/restaurant" replace />
    case 'courier':    return <Navigate to="/courier" replace />
    default:           return <Navigate to="/" replace />
  }
}

export default function App() {
  const [roleChecked, setRoleChecked] = useState(false)

  // Uygulama açıldığında /auth/me ile güncel rolü kontrol et.
  // Admin başvuruyu onayladıktan sonra kullanıcının localStorage'ı eski rolü
  // gösteriyor olabilir — burada senkronize ediyoruz.
  useEffect(() => {
    const syncRole = async () => {
      if (!authService.isLoggedIn()) { setRoleChecked(true); return }
      try {
        const me = await authService.me()
        const cached = authService.getUser()
        if (cached && me.role !== cached.role) {
          // Rol değişmiş — localStorage'daki user kaydını güncelle
          localStorage.setItem('user', JSON.stringify(me))
          // Yeni role göre sayfayı yenile
          window.location.replace(
            me.role === 'restaurant' ? '/restaurant' :
            me.role === 'admin'      ? '/admin'      :
            me.role === 'courier'    ? '/courier'    : '/'
          )
          return
        }
      } catch {
        // Token süresi dolmuşsa veya ağ hatası — sessizce geç
      }
      setRoleChecked(true)
    }
    syncRole()
  }, [])

  if (!roleChecked) return null   // Rol kontrolü tamamlanana kadar beyaz ekran yerine boş render

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
      <ThemeProvider>
        <AddressProvider>
          <BrowserRouter>
            <AddressPickerModal />
            <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
        <Route path="/checkout" element={
          <PrivateRoute><CheckoutPage /></PrivateRoute>
        } />
        <Route path="/tracking/:orderId" element={
          <PrivateRoute><TrackingPage /></PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute><AdminPage /></PrivateRoute>
        } />
        <Route path="/restaurant" element={
          <PrivateRoute><RestaurantPage /></PrivateRoute>
        } />
        <Route path="/courier" element={
          <PrivateRoute><CourierPage /></PrivateRoute>
        } />
        <Route path="/wallet" element={
          <PrivateRoute><WalletPage /></PrivateRoute>
        } />
        <Route path="/orders" element={
          <PrivateRoute><OrdersPage /></PrivateRoute>
        } />
        <Route path="/account" element={
          <PrivateRoute><AccountPage /></PrivateRoute>
        } />
        <Route path="/partner/apply" element={<PartnerApplyPage />} />
        <Route path="/gizlilik" element={<PrivacyPage />} />
        <Route path="/kullanim-kosullari" element={<TermsPage />} />
        <Route path="/kvkk" element={<KvkkPage />} />
        <Route path="/cerez-politikasi" element={<CookiePolicyPage />} />
        <Route path="/bilgi-toplumu" element={<InfoSocietyPage />} />
        <Route path="/veri-talebi" element={<DataRequestPage />} />
        <Route path="/yardim" element={<HelpPage />} />
        <Route path="/sss" element={<FaqPage />} />
        <Route path="/iletisim" element={<ContactPage />} />
        <Route path="/siparis-takibi" element={<OrderTrackingInfoPage />} />
        <Route path="/uygulamayi-indir" element={<DownloadAppPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </BrowserRouter>
        </AddressProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  )
}
