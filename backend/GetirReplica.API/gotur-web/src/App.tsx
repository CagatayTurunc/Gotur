import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
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
  return (
    <GoogleOAuthProvider clientId="914551771224-paoe96g7gqeca4gqsa912fuofqfm5p0b.apps.googleusercontent.com">
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
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </BrowserRouter>
        </AddressProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  )
}
