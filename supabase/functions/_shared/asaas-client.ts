import {
  isTimeoutError,
  parseAsaasError,
} from "./asaas-billing.ts";

export const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") ?? "https://api.asaas.com/v3";
const TIMEOUT_MS = 20000;

export type AsaasSubscription = {
  id: string;
  customer?: string;
  status?: string;
  nextDueDate?: string;
  invoiceUrl?: string;
  paymentLink?: string;
};

export type AsaasPayment = {
  id: string;
  status?: string;
  dueDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
  subscription?: string;
};

export class AsaasRequestError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly timedOut = false,
  ) {
    super(message);
    this.name = "AsaasRequestError";
  }
}

export function asaasHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    access_token: apiKey,
  };
}

export async function asaasFetch<T>(opts: {
  path: string;
  apiKey: string;
  method?: string;
  body?: unknown;
}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ASAAS_API_URL}${opts.path}`, {
      method: opts.method ?? "GET",
      headers: asaasHeaders(opts.apiKey),
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });

    let parsed: unknown = null;
    const raw = await res.text();
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    if (!res.ok) {
      throw new AsaasRequestError(parseAsaasError(parsed, res.status), res.status);
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof AsaasRequestError) throw err;
    if (isTimeoutError(err)) {
      throw new AsaasRequestError("Asaas timeout", 0, true);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function getSubscription(
  apiKey: string,
  id: string,
): Promise<AsaasSubscription | null> {
  try {
    return await asaasFetch<AsaasSubscription>({
      path: `/subscriptions/${id}`,
      apiKey,
    });
  } catch (err) {
    if (err instanceof AsaasRequestError && err.httpStatus === 404) return null;
    throw err;
  }
}

export async function listCustomerSubscriptions(
  apiKey: string,
  customerId: string,
): Promise<AsaasSubscription[]> {
  const result = await asaasFetch<{ data?: AsaasSubscription[] }>({
    path: `/subscriptions?customer=${encodeURIComponent(customerId)}&limit=20`,
    apiKey,
  });
  return result.data ?? [];
}

export async function updateSubscriptionNextDueDate(
  apiKey: string,
  subscriptionId: string,
  nextDueDate: string,
): Promise<AsaasSubscription> {
  return await asaasFetch<AsaasSubscription>({
    path: `/subscriptions/${subscriptionId}`,
    apiKey,
    method: "POST",
    body: { nextDueDate },
  });
}

export async function listPendingPayments(
  apiKey: string,
  subscriptionId: string,
): Promise<AsaasPayment[]> {
  const result = await asaasFetch<{ data?: AsaasPayment[] }>({
    path: `/payments?subscription=${encodeURIComponent(subscriptionId)}&status=PENDING&limit=20`,
    apiKey,
  });
  return result.data ?? [];
}

export async function deletePayment(apiKey: string, paymentId: string): Promise<void> {
  await asaasFetch({
    path: `/payments/${paymentId}`,
    apiKey,
    method: "DELETE",
  });
}
