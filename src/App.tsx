import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { PublicLayout } from './components/PublicLayout'
import { DashboardLayout } from './components/DashboardLayout'
import { ShopList } from './pages/public/ShopList'
import { ShopBooking } from './pages/public/ShopBooking'
import { ShopPublic } from './pages/public/ShopPublic'
import { BookingConfirm } from './pages/public/BookingConfirm'
import { ClientAuth } from './pages/public/ClientAuth'
import { MyBookings } from './pages/public/MyBookings'
import { BarberAuth } from './pages/dashboard/BarberAuth'
import { Dashboard } from './pages/dashboard/Dashboard'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<ShopList />} />
            <Route path="b/:slug" element={<ShopPublic />} />
            <Route path="barbearia/:shopId" element={<ShopBooking />} />
            <Route path="confirmacao/:bookingId" element={<BookingConfirm />} />
            <Route path="entrar" element={<ClientAuth />} />
            <Route path="cadastro" element={<ClientAuth />} />
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
