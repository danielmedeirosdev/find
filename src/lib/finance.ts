import type { BookingWithDetails, FinancialTransaction } from "./types";
export type Period = "today" | "week" | "month";
export function cents(value: number | string | null | undefined): number {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) throw new Error("Valor financeiro inválido");
  return Math.round((amount + Number.EPSILON) * 100);
}
export function periodStart(period: Period, now = new Date()): string {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  if (period === "month") day.setDate(1);
  if (period === "week") day.setDate(day.getDate() - day.getDay());
  return day.toISOString();
}
export function cashTotals(rows: FinancialTransaction[]) {
  const income = rows
    .filter((t) => t.type === "entrada")
    .reduce((v, t) => v + cents(t.amount), 0);
  const expenses = rows
    .filter((t) => t.type === "saida")
    .reduce((v, t) => v + cents(t.amount), 0);
  return {
    income: income / 100,
    expenses: expenses / 100,
    balance: (income - expenses) / 100,
  };
}
/** The saved quote is authoritative; catalogue changes must not rewrite history. */
export function bookingTotal(booking: BookingWithDetails): number {
  if (booking.quoted_amount != null) return cents(booking.quoted_amount) / 100;
  const services =
    booking.services_amount != null
      ? cents(booking.services_amount)
      : (booking.booking_services || []).reduce(
          (s, r) => s + cents(r.services?.price),
          0,
        );
  const options = (booking.booking_custom_field_answers || []).reduce(
    (s, r) => s + cents(r.price_delta),
    0,
  );
  return (
    Math.max(
      0,
      services +
        options +
        cents(booking.extras_amount) +
        cents(booking.pet_transport_fee) -
        cents(booking.discount_amount),
    ) / 100
  );
}
export function selectedBookingTotal(
  booking: BookingWithDetails,
  ids: Set<string>,
  catalogue: { id: string; price: number }[],
  transport: number,
): number {
  const existing = new Set(
    (booking.booking_services || []).map((s) => s.service_id),
  );
  const removed = (booking.booking_services || [])
    .filter((s) => !ids.has(s.service_id))
    .reduce((v, s) => v + cents(s.services.price), 0);
  const added = catalogue
    .filter((s) => ids.has(s.id) && !existing.has(s.id))
    .reduce((v, s) => v + cents(s.price), 0);
  return (
    Math.max(
      0,
      cents(bookingTotal(booking)) -
        removed +
        added -
        cents(booking.pet_transport_fee) +
        cents(transport),
    ) / 100
  );
}

export function amountDue(total:number, servicesAmount:number, coveredByPackage:boolean):number {
 return Math.max(0,cents(total)-(coveredByPackage?cents(servicesAmount):0))/100
}
