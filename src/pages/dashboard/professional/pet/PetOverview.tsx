import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { localDateIso } from "../../../../lib/booking";
import { cashTotals, periodStart } from "../../../../lib/finance";
import {
  formatPrice,
  formatTime,
  bookingStatusLabel,
} from "../../../../lib/format";
import {
  LoadingBlock,
  InlineError,
  EmptyState,
} from "../../../../components/EmptyState";
import type {
  BookingWithDetails,
  FinancialTransaction,
  PetBusinessType,
} from "../../../../lib/types";
interface Props {
  shopId: string;
  businessType?: PetBusinessType | null;
  onNavigate: (tab: string) => void;
}
export function PetOverview({ shopId, onNavigate }: Props) {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [b, t] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "*,barbers(name),pets!bookings_pet_id_fkey(name),booking_services(service_id,services(name,price))",
        )
        .eq("shop_id", shopId)
        .eq("date", localDateIso())
        .order("time"),
      supabase
        .from("financial_transactions")
        .select("*")
        .eq("shop_id", shopId)
        .gte("created_at", periodStart("today")),
    ]);
    if (b.error || t.error)
      setError("Não foi possível carregar o resumo. Tente novamente.");
    else {
      setBookings((b.data as BookingWithDetails[]) || []);
      setTransactions((t.data as FinancialTransaction[]) || []);
    }
    setLoading(false);
  }, [shopId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading) return <LoadingBlock label="Carregando seu dia..." />;
  if (error)
    return (
      <div>
        <InlineError message={error} />
        <button onClick={() => void load()} className="mt-3 text-brass">
          Tentar novamente
        </button>
      </div>
    );
  const active = bookings.filter(
    (b) => !["completed", "cancelled", "no_show"].includes(b.status || ""),
  );
  const totals = cashTotals(transactions);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-charcoal-muted">
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </p>
          <h2 className="mt-1">Seu dia no onefind</h2>
        </div>
        <button
          onClick={() => onNavigate("agenda")}
          className="rounded-lg bg-brass px-4 py-2 text-sm font-semibold text-charcoal"
        >
          Abrir agenda
        </button>
      </header>
      <div className="of-kpis">
        <Kpi
          label="Atendimentos hoje"
          value={String(
            bookings.filter(
              (b) => !["cancelled", "no_show"].includes(b.status || ""),
            ).length,
          )}
        />
        <Kpi
          label="Em atendimento"
          value={String(
            active.filter((b) => b.status === "in_progress").length,
          )}
        />
        <Kpi
          label="Finalizados hoje"
          value={String(
            bookings.filter((b) => b.status === "completed").length,
          )}
        />
        <Kpi label="Recebido hoje" value={formatPrice(totals.income)} />
      </div>
      <section className="of-section">
        <div className="of-section-heading">
          <h3>Próximos atendimentos</h3>
          <span className="text-xs text-charcoal-muted">
            {active.length} na agenda
          </span>
        </div>
        {active.length ? (
          active.map((b) => (
            <button
              key={b.id}
              onClick={() => onNavigate("agenda")}
              className="of-booking-row w-full text-left"
            >
              <span className="text-sm font-semibold text-brass">
                {formatTime(b.time)}
              </span>
              <span>
                <strong className="text-sm">
                  {b.pets?.name || b.client_name}
                </strong>
                <small>
                  {b.client_name}
                  {b.barbers?.name ? ` · ${b.barbers.name}` : ""}
                </small>
                <small>
                  {b.booking_services?.map((s) => s.services.name).join(" + ")}
                </small>
              </span>
              <span className="of-status">
                {bookingStatusLabel(b.status || "scheduled")}
              </span>
            </button>
          ))
        ) : (
          <EmptyState
            title="Agenda livre por hoje"
            description="Crie um atendimento na agenda para começar."
          />
        )}
      </section>
      <section className="of-section">
        <div className="of-section-heading">
          <h3>Caixa de hoje</h3>
          <button
            onClick={() => onNavigate("cashflow")}
            className="text-sm text-brass"
          >
            Ver financeiro
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-charcoal-muted">Entradas</p>
            <p className="mt-2">{formatPrice(totals.income)}</p>
          </div>
          <div>
            <p className="text-xs text-charcoal-muted">Saídas</p>
            <p className="mt-2">{formatPrice(totals.expenses)}</p>
          </div>
          <div>
            <p className="text-xs text-charcoal-muted">Saldo</p>
            <p className="mt-2 text-brass">{formatPrice(totals.balance)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="of-kpi">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
