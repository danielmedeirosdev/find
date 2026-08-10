import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { PublicLayout } from './components/PublicLayout'
import { DashboardLayout } from './components/DashboardLayout'
import { PlatformHome } from './pages/public/PlatformHome'
import { ShopList } from './pages/public/ShopList'
import { ShopBooking } from './pages/public/ShopBooking'
import { ShopPublic } from './pages/public/ShopPublic'
import { PetBooking } from './pages/public/PetBooking'
import { BookingConfirm } from './pages/public/BookingConfirm'
import { ClientAuth } from './pages/public/ClientAuth'
import { MyBookings } from './pages/public/MyBookings'
import { AuthCallback } from './pages/AuthCallback'
import { BarberAuth } from './pages/dashboard/BarberAuth'
import { Dashboard } from './pages/dashboard/Dashboard'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<PlatformHome />} />
            <Route path="barbearia" element={<ShopList segment="barbershop" />} />
            <Route path="barbearia/:shopId" element={<ShopBooking />} />
            <Route path="pet" element={<ShopList segment="pet" />} />
            <Route path="pet/:shopId" element={<PetBooking />} />
            <Route path="b/:slug" element={<ShopPublic />} />
            <Route path="confirmacao/:bookingId" element={<BookingConfirm />} />
            <Route path="entrar" element={<ClientAuth />} />
            <Route path="cadastro" element={<ClientAuth />} />
            <Route path="auth/callback" element={<AuthCallback />} />
            <Route path="minhas-reservas" element={<MyBookings />} />
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
