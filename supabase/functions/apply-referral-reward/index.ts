import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  decideApplyPath,
  computePostponedDueDate,
  isPendingPaymentStatus,
  isUnexpectedSubscription,
  lockReasonMessage,
  pickActiveSubscription,
  utcTodayIso,
} from "../_shared/asaas-billing.ts";
import {
  AsaasRequestError,
  deletePayment,
  getSubscription,
  listCustomerSubscriptions,
  listPendingPayments,
  updateSubscriptionNextDueDate,
  type AsaasSubscription,
} from "../_shared/asaas-client.ts";
import { corsFor } from "../_shared/cors.ts";

type LockResult = {
  ok: boolean;
  reason?: string;
  reward?: {
    id: string;
    shop_id: string;
    months: number;
    referral_id: string | null;
    asaas_subscription_id: string | null;
    asaas_next_due_before: string | null;
    asaas_next_due_after: string | null;
    applied_via: string | null;
  };
};

type ShopRow = {
  id: string;
  owner_user_id: string;
  subscription_status: "trial" | "active" | "blocked";
  trial_ends_at: string | null;
  complimentary_until: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
};

function json(corsHeaders: HeadersInit, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function uuidLike(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function persistSubscriptionLink(
  admin: SupabaseClient,
  shopId: string,
  subscriptionId: string,
) {
  const { data: shop } = await admin
    .from("shops")
    .select("asaas_subscription_id")
    .eq("id", shopId)
    .maybeSingle();

  if (shop?.asaas_subscription_id === subscriptionId) return;

  await admin
    .from("shops")
    .update({ asaas_subscription_id: subscriptionId })
    .eq("id", shopId);

  await admin.from("referral_events").insert({
    kind: "subscription_linked",
    shop_id: shopId,
    payload: {
      asaas_subscription_id: subscriptionId,
      previous_asaas_subscription_id: shop?.asaas_subscription_id ?? null,
      source: "apply-referral-reward",
    },
  });
}

async function resolveAsaasSubscription(
  apiKey: string,
  shop: ShopRow,
): Promise<AsaasSubscription | null> {
  if (shop.asaas_subscription_id) {
    const stored = await getSubscription(apiKey, shop.asaas_subscription_id);
    if (stored?.status === "ACTIVE") return stored;
  }
  if (!shop.asaas_customer_id) return null;
  const listed = await listCustomerSubscriptions(apiKey, shop.asaas_customer_id);
  return pickActiveSubscription(shop.asaas_subscription_id, listed);
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const corsHeaders = cors.headers;
  if (req.method === "OPTIONS") {
    return new Response(cors.allowed ? "ok" : "Forbidden", {
      status: cors.allowed ? 200 : 403,
      headers: corsHeaders,
    });
  }
  if (!cors.allowed) {
    return json(corsHeaders, { error: "Forbidden origin" }, 403);
  }
  if (req.method !== "POST") {
    return json(corsHeaders, { error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json(corsHeaders, { error: "Unauthorized" }, 401);
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return json(corsHeaders, { error: "Unauthorized" }, 401);
  }

  let rewardId: unknown;
  try {
    const body = await req.json();
    rewardId = body?.reward_id;
  } catch {
    return json(corsHeaders, { error: "Invalid JSON" }, 400);
  }

  if (!uuidLike(rewardId)) {
    return json(corsHeaders, { error: "reward_id required" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let locked = false;
  let asaasSnapshot: {
    subscriptionId: string;
    nextDueBefore: string | null;
    nextDueAfter: string;
  } | null = null;
  try {
    const { data: lockData, error: lockError } = await admin.rpc("lock_referral_reward", {
      p_reward_id: rewardId,
      p_owner_user_id: user.id,
    });
    if (lockError) throw lockError;

    const lock = lockData as LockResult;
    if (!lock?.ok || !lock.reward) {
      const reason = lock?.reason ?? "not_available";
      const status = reason === "forbidden" || reason === "not_found" ? 403 : 409;
      return json(corsHeaders, {
        error: lockReasonMessage(reason),
        reason,
      }, status);
    }
    locked = true;
    const reward = lock.reward;

    const { data: shop, error: shopError } = await admin
      .from("shops")
      .select(
        "id, owner_user_id, subscription_status, trial_ends_at, complimentary_until, asaas_customer_id, asaas_subscription_id",
      )
      .eq("id", reward.shop_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (shopError || !shop) {
      await admin.rpc("release_referral_reward", {
        p_reward_id: rewardId,
        p_error: "shop_mismatch",
      });
      locked = false;
      return json(corsHeaders, {
        error: lockReasonMessage("forbidden"),
        reason: "forbidden",
      }, 403);
    }

    const typedShop = shop as ShopRow;
    const path = decideApplyPath(typedShop);

    if (path === "overdue_refuse") {
      await admin.rpc("release_referral_reward", {
        p_reward_id: rewardId,
        p_error: "overdue",
      });
      locked = false;
      return json(corsHeaders, {
        error: lockReasonMessage("overdue"),
        reason: "overdue",
      }, 409);
    }

    if (path === "missing_subscription") {
      await admin.rpc("release_referral_reward", {
        p_reward_id: rewardId,
        p_error: "missing_subscription",
      });
      locked = false;
      return json(corsHeaders, {
        error: lockReasonMessage("missing_subscription"),
        reason: "missing_subscription",
      }, 409);
    }

    if (path === "trial_extension") {
      const { data: finalized, error: finalizeError } = await admin.rpc(
        "finalize_referral_reward",
        {
          p_reward_id: rewardId,
          p_applied_via: "trial_extension",
        },
      );
      if (finalizeError) throw finalizeError;
      locked = false;
      return json(corsHeaders, {
        ok: true,
        applied_via: "trial_extension",
        months: reward.months,
        result: finalized,
      });
    }

    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) {
      await admin.rpc("release_referral_reward", {
        p_reward_id: rewardId,
        p_error: "ASAAS_API_KEY not configured",
      });
      locked = false;
      return json(corsHeaders, { error: lockReasonMessage("asaas") }, 500);
    }

    if (reward.asaas_next_due_after) {
      if (reward.asaas_subscription_id) {
        const pending = await listPendingPayments(apiKey, reward.asaas_subscription_id);
        for (const payment of pending) {
          if (!isPendingPaymentStatus(payment.status) || !payment.id) continue;
          await deletePayment(apiKey, payment.id);
        }
      }
      const { data: finalized, error: finalizeError } = await admin.rpc(
        "finalize_referral_reward",
        {
          p_reward_id: rewardId,
          p_applied_via: "asaas_postpone",
          p_asaas_subscription_id: reward.asaas_subscription_id,
          p_next_due_before: reward.asaas_next_due_before,
          p_next_due_after: reward.asaas_next_due_after,
        },
      );
      if (finalizeError) throw finalizeError;
      locked = false;
      return json(corsHeaders, {
        ok: true,
        applied_via: "asaas_postpone",
        months: reward.months,
        next_charge_on: reward.asaas_next_due_after,
        result: finalized,
        recovered: true,
      });
    }

    const subscription = await resolveAsaasSubscription(apiKey, typedShop);
    if (!subscription || isUnexpectedSubscription(subscription)) {
      if (typedShop.subscription_status === "trial" || typedShop.subscription_status === "blocked") {
        const { data: finalized, error: finalizeError } = await admin.rpc(
          "finalize_referral_reward",
          {
            p_reward_id: rewardId,
            p_applied_via: "trial_extension",
          },
        );
        if (finalizeError) throw finalizeError;
        locked = false;
        return json(corsHeaders, {
          ok: true,
          applied_via: "trial_extension",
          months: reward.months,
          result: finalized,
        });
      }
      await admin.rpc("release_referral_reward", {
        p_reward_id: rewardId,
        p_error: "asaas_subscription_not_found",
      });
      locked = false;
      return json(corsHeaders, {
        error: lockReasonMessage("missing_subscription"),
        reason: "missing_subscription",
      }, 409);
    }

    await persistSubscriptionLink(admin, typedShop.id, subscription.id);

    const nextDueBefore = subscription.nextDueDate ?? null;
    const nextDueAfter = computePostponedDueDate(
      nextDueBefore,
      reward.months,
      utcTodayIso(),
    );

    const updated = await updateSubscriptionNextDueDate(
      apiKey,
      subscription.id,
      nextDueAfter,
    );
    if (isUnexpectedSubscription(updated) || updated.nextDueDate !== nextDueAfter) {
      throw new AsaasRequestError("Resposta inesperada ao adiar nextDueDate", 502);
    }

    asaasSnapshot = {
      subscriptionId: subscription.id,
      nextDueBefore,
      nextDueAfter,
    };

    await admin
      .from("referral_rewards")
      .update({
        asaas_subscription_id: subscription.id,
        asaas_next_due_before: nextDueBefore,
        asaas_next_due_after: nextDueAfter,
      })
      .eq("id", rewardId)
      .eq("status", "applying");

    const pending = await listPendingPayments(apiKey, subscription.id);
    for (const payment of pending) {
      if (!isPendingPaymentStatus(payment.status) || !payment.id) continue;
      await deletePayment(apiKey, payment.id);
    }

    const leftover = await listPendingPayments(apiKey, subscription.id);
    const stillDueSoon = leftover.some((payment) =>
      isPendingPaymentStatus(payment.status) &&
      payment.dueDate &&
      payment.dueDate < nextDueAfter
    );
    if (stillDueSoon) {
      console.error("Pending Asaas payments remain after postpone", leftover);
    }

    const { data: finalized, error: finalizeError } = await admin.rpc(
      "finalize_referral_reward",
      {
        p_reward_id: rewardId,
        p_applied_via: "asaas_postpone",
        p_asaas_subscription_id: subscription.id,
        p_next_due_before: nextDueBefore,
        p_next_due_after: nextDueAfter,
      },
    );
    if (finalizeError) throw finalizeError;
    locked = false;

    return json(corsHeaders, {
      ok: true,
      applied_via: "asaas_postpone",
      months: reward.months,
      next_charge_on: nextDueAfter,
      result: finalized,
    });
  } catch (err) {
    console.error("apply-referral-reward error", err);
    if (asaasSnapshot) {
      const { error: finalizeError } = await admin.rpc("finalize_referral_reward", {
        p_reward_id: rewardId,
        p_applied_via: "asaas_postpone",
        p_asaas_subscription_id: asaasSnapshot.subscriptionId,
        p_next_due_before: asaasSnapshot.nextDueBefore,
        p_next_due_after: asaasSnapshot.nextDueAfter,
      });
      if (!finalizeError) {
        return json(corsHeaders, {
          ok: true,
          applied_via: "asaas_postpone",
          next_charge_on: asaasSnapshot.nextDueAfter,
          recovered: true,
        });
      }
      return json(corsHeaders, {
        error: "Não foi possível aplicar seu benefício. Tente novamente.",
        reason: "finalize_failed",
      }, 500);
    }
    if (locked) {
      const message = err instanceof AsaasRequestError
        ? err.message
        : err instanceof Error
        ? err.message
        : "unknown";
      await admin.rpc("release_referral_reward", {
        p_reward_id: rewardId,
        p_error: message.slice(0, 500),
      });
    }
    const timedOut = err instanceof AsaasRequestError && err.timedOut;
    return json(corsHeaders, {
      error: "Não foi possível aplicar seu benefício. Tente novamente.",
      reason: timedOut ? "timeout" : "asaas_error",
    }, timedOut ? 504 : 500);
  }
});
