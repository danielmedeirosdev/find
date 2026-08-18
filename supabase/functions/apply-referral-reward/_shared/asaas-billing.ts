export type SubscriptionStatus = "trial" | "active" | "blocked";

export type ApplyPath =
  | "overdue_refuse"
  | "asaas_postpone"
  | "trial_extension"
  | "missing_subscription";

export type ShopBillingSnapshot = {
  subscription_status: SubscriptionStatus;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
};

export function decideApplyPath(shop: ShopBillingSnapshot): ApplyPath {
  const hasSub = Boolean(shop.asaas_subscription_id);
  if (shop.subscription_status === "blocked" && hasSub) return "overdue_refuse";
  if (hasSub) return "asaas_postpone";
  if (shop.subscription_status === "active") {
    return shop.asaas_customer_id ? "asaas_postpone" : "missing_subscription";
  }
  return "trial_extension";
}

export function addCalendarMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();
  shifted.setUTCDate(Math.min(day, lastDay));
  return shifted.toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function utcTodayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function computePostponedDueDate(
  currentNextDue: string | null,
  months: number,
  todayIso: string,
): string {
  const tomorrow = addDaysIso(todayIso, 1);
  const base = currentNextDue && currentNextDue > tomorrow ? currentNextDue : tomorrow;
  return addCalendarMonths(base, months);
}

export function nextDueFromComplimentary(
  complimentaryUntil: string | null | undefined,
  tomorrowIso: string,
): string {
  if (!complimentaryUntil) return tomorrowIso;
  const date = complimentaryUntil.slice(0, 10);
  return date > tomorrowIso ? date : tomorrowIso;
}

export function isPendingPaymentStatus(status: string | undefined | null): boolean {
  return status === "PENDING";
}

export function parseAsaasError(body: unknown, httpStatus: number): string {
  if (body && typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: Array<{ description?: string }> }).errors;
    const desc = errors?.map((item) => item.description).filter(Boolean).join("; ");
    if (desc) return desc;
  }
  if (httpStatus === 0) return "Asaas timeout";
  return `Asaas HTTP ${httpStatus}`;
}

export function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "TimeoutError" || err.name === "AbortError" || /timeout/i.test(err.message);
}

export function isUnexpectedSubscription(body: unknown): boolean {
  if (!body || typeof body !== "object") return true;
  const id = (body as { id?: unknown }).id;
  return typeof id !== "string" || id.length < 3;
}

export function pickActiveSubscription<T extends { id?: string; status?: string }>(
  storedId: string | null,
  items: T[],
): T | null {
  const active = items.filter((item) => item.status === "ACTIVE" && typeof item.id === "string");
  if (storedId) {
    const match = active.find((item) => item.id === storedId);
    if (match) return match;
  }
  return active[0] ?? null;
}

export function lockReasonMessage(reason: string): string {
  switch (reason) {
    case "already_redeemed":
      return "Esta recompensa já foi aplicada.";
    case "forbidden":
    case "not_found":
      return "Não foi possível aplicar seu benefício. Tente novamente.";
    case "in_progress":
      return "Esta recompensa já está sendo aplicada. Aguarde alguns instantes.";
    case "overdue":
      return "Regularize o pagamento da assinatura antes de aplicar o benefício.";
    case "missing_subscription":
      return "Não encontramos sua assinatura no Asaas. Tente novamente ou fale com o suporte.";
    default:
      return "Não foi possível aplicar seu benefício. Tente novamente.";
  }
}
