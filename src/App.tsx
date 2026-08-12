import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { PublicLayout } from './components/PublicLayout'
import { DashboardLayout } from './components/DashboardLayout'
import { MarketingLanding } from './pages/public/MarketingLanding'
import { ShopList } from './pages/public/ShopList'
import { ShopBooking } from './pages/public/ShopBooking'
import { ShopPublic } from './pages/public/ShopPublic'
import { PetBooking } from './pages/public/PetBooking'
import { GuestReview } from './pages/public/GuestReview'
import { BookingConfirm } from './pages/public/BookingConfirm'
import { ClientAuth } from './pages/public/ClientAuth'
import { MyBookings } from './pages/public/MyBookings'
import { PrivacyPolicy } from './pages/public/PrivacyPolicy'
import { AuthCallback } from './pages/AuthCallback'
import { BarberAuth } from './pages/dashboard/BarberAuth'
import { Dashboard } from './pages/dashboard/Dashboard'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route index element={<MarketingLanding />} />
          <Route path="solucoes" element={<Navigate to="/" replace />} />

          <Route element={<PublicLayout />}>
            <Route path="barbearia" element={<ShopList segment="barbershop" />} />
            <Route path="barbearia/:shopId" element={<ShopBooking />} />
            <Route path="pet" element={<ShopList segment="pet" />} />
            <Route path="pet/:shopId" element={<PetBooking />} />
            <Route path="b/:slug" element={<ShopPublic />} />
            <Route path="confirmacao/:bookingId" element={<BookingConfirm />} />
            <Route path="avaliar/:bookingId" element={<GuestReview />} />
            <Route path="entrar" element={<ClientAuth />} />
            <Route path="cadastro" element={<ClientAuth />} />
            <Route path="auth/callback" element={<AuthCallback />} />
            <Route path="minhas-reservas" element={<MyBookings />} />
            <Route path="privacidade" element={<PrivacyPolicy />} />
          </Route>

          <Route path="painel" element={<DashboardLayout />}>
            <Route index element={<BarberAuth />} />
            <Route path="dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
