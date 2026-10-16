import { BrowserRouter, Navigate, Routes, Route, useParams } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ReferralCapture } from './components/ReferralCapture'
import { PublicLayout } from './components/PublicLayout'
import { DashboardLayout } from './components/DashboardLayout'
import { MarketingLanding } from './pages/public/MarketingLanding'
import { ShopPublic } from './pages/public/ShopPublic'
import { PetBooking } from './pages/public/PetBooking'
import { GuestReview } from './pages/public/GuestReview'
import { BookingConfirm } from './pages/public/BookingConfirm'
import { ClientAuth } from './pages/public/ClientAuth'
import { MyBookings } from './pages/public/MyBookings'
import { PrivacyPolicy } from './pages/public/PrivacyPolicy'
import { Faq } from './pages/public/Faq'
import { NotFound } from './pages/public/NotFound'
import { AuthCallback } from './pages/AuthCallback'
import { BusinessAuth } from './pages/dashboard/BusinessAuth'
import { Dashboard } from './pages/dashboard/Dashboard'
import { MetaPixelTracker } from './components/MetaPixelTracker'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MetaPixelTracker />
        <ReferralCapture />
        <Routes>
          <Route index element={<MarketingLanding />} />
          <Route path="apresentacao" element={<MarketingLanding />} />
          <Route path="pet" element={<MarketingLanding />} />
          <Route path="faq" element={<Faq />} />
          <Route path="solucoes" element={<Navigate to="/" replace />} />

          <Route element={<PublicLayout />}>
            <Route path="pet/:shopId" element={<PetBooking />} />
            <Route path="b/:slug" element={<LegacyShopRedirect />} />
            <Route path="confirmacao/:bookingId" element={<BookingConfirm />} />
            <Route path="avaliar/:bookingId" element={<GuestReview />} />
            <Route path="entrar" element={<ClientAuth />} />
            <Route path="cadastro" element={<ClientAuth />} />
            <Route path="auth/callback" element={<AuthCallback />} />
            <Route path="minhas-reservas" element={<MyBookings />} />
            <Route path="privacidade" element={<PrivacyPolicy />} />

            <Route path="novidades" element={<Navigate to="/" replace />} />
            <Route path=":slug" element={<ShopPublic />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="painel" element={<DashboardLayout />}>
            <Route index element={<BusinessAuth />} />
            <Route path="dashboard" element={<Dashboard />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function LegacyShopRedirect() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={`/${slug ?? ''}`} replace />
}
