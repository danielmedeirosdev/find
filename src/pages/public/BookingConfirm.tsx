import { useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { getTotalDuration } from '../../lib/booking'
import { getBookingReceipt, readBookingPhone } from '../../lib/secureBooking'
import { petSizeLabel } from '../../lib/pet'
import { ConfirmReceipt, type ReceiptView } from '../../components/public/ConfirmReceipt'
import { PageLoader } from '../../components/public/PageLoader'
import type { BookingConfirmationState, BookingWithDetails } from '../../lib/types'
import { useAuth } from '../../contexts/AuthContext'

function viewFromState(state: BookingConfirmationState): ReceiptView {
  const isPet = Boolean(state.petName)
  return {
    isPet,
    shopName: state.shopName,
    shopAddress: state.shopAddress,
    barberName: state.barberName,
    date: state.date,
    time: state.time,
    durationMinutes: state.durationMinutes ?? getTotalDuration(state.services),
    clientName: state.clientName,
    clientPhone: state.clientPhone,
    services: state.services.map((s) => ({
      id: s.id,
      name: s.name,
      price: Number(s.price),
    })),
    petName: state.petName,
    petSize: state.petSize,
    notes: state.notes,
  }
}

function viewFromBooking(booking: BookingWithDetails): ReceiptView {
  const services = (booking.booking_services || []).map((bs) => bs.services)
  const isPet = booking.shops?.segment === 'pet' || Boolean(booking.pets?.name)
  return {
    isPet,
    shopName: booking.shops?.name || 'Estabelecimento',
    shopAddress: booking.shops?.address,
    barberName: booking.barbers?.name,
    date: booking.date,
    time: booking.time,
    durationMinutes: getTotalDuration(services),
    clientName: booking.client_name,
    clientPhone: booking.client_phone,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      price: Number(s.price),
    })),
    petName: booking.pets?.name,
    petSize: booking.pets?.size ? petSizeLabel(booking.pets.size) : null,
    notes: booking.notes,
  }
}

export function BookingConfirm() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const confirmationState = location.state as BookingConfirmationState | null
  const [booking, setBooking] = useState<BookingWithDetails | null>(null)
  const [loading, setLoading] = useState(!confirmationState)

  useEffect(() => {
    if (confirmationState || !bookingId) return

    async function load() {
      const phone = readBookingPhone(bookingId!)
      if (!phone) {
        setLoading(false)
        return
      }
      try {
        const data = await getBookingReceipt(bookingId!, phone)
        setBooking(data)
      } catch {
        setBooking(null)
      }
      setLoading(false)
    }
    load()
  }, [bookingId, confirmationState])

  if (loading) return <PageLoader label="Carregando comprovante" />

  if (confirmationState) {
    return <ConfirmReceipt view={viewFromState(confirmationState)} signedIn={Boolean(user)} />
  }

  if (!booking) {
    return (
      <p className="py-16 text-center text-ink-muted">
        Agendamento não encontrado. Se você acabou de marcar, volte pela confirmação na tela anterior.
      </p>
    )
  }

  return <ConfirmReceipt view={viewFromBooking(booking)} signedIn={Boolean(user)} />
}
