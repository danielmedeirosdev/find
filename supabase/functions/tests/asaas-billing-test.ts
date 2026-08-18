import {
  addCalendarMonths,
  computePostponedDueDate,
  decideApplyPath,
  isPendingPaymentStatus,
  isUnexpectedSubscription,
  nextDueFromComplimentary,
  parseAsaasError,
  pickActiveSubscription,
} from "../_shared/asaas-billing.ts";

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label);
}

Deno.test("date helpers postpone whole months without new subscriptions", () => {
  assert(addCalendarMonths("2026-01-31", 1) === "2026-02-28", "month overflow");
  assert(addCalendarMonths("2026-01-15", 3) === "2026-04-15", "three months");
  assert(computePostponedDueDate("2026-08-10", 1, "2026-08-18") === "2026-09-19", "past due");
  assert(computePostponedDueDate("2026-10-05", 3, "2026-08-18") === "2027-01-05", "multi month");
  assert(nextDueFromComplimentary("2026-12-01T12:00:00Z", "2026-08-19") === "2026-12-01", "trial complimentary");
});

Deno.test("billing path respects trial, overdue, active and missing subscription", () => {
  assert(
    decideApplyPath({
      subscription_status: "blocked",
      asaas_customer_id: "cus",
      asaas_subscription_id: "sub",
    }) === "overdue_refuse",
    "overdue",
  );
  assert(
    decideApplyPath({
      subscription_status: "trial",
      asaas_customer_id: null,
      asaas_subscription_id: null,
    }) === "trial_extension",
    "trial",
  );
  assert(
    decideApplyPath({
      subscription_status: "active",
      asaas_customer_id: "cus",
      asaas_subscription_id: "sub",
    }) === "asaas_postpone",
    "active",
  );
  assert(
    decideApplyPath({
      subscription_status: "active",
      asaas_customer_id: null,
      asaas_subscription_id: null,
    }) === "missing_subscription",
    "missing",
  );
});

Deno.test("Asaas payment and payload guards", () => {
  assert(isPendingPaymentStatus("PENDING"), "pending");
  assert(!isPendingPaymentStatus("OVERDUE"), "do not delete overdue");
  assert(!isPendingPaymentStatus("CONFIRMED"), "do not delete confirmed");
  assert(parseAsaasError({ errors: [{ description: "falhou" }] }, 400) === "falhou", "error parse");
  assert(isUnexpectedSubscription({}), "empty");
  assert(!isUnexpectedSubscription({ id: "sub_1" }), "ok");
  assert(
    pickActiveSubscription("sub_b", [
      { id: "sub_a", status: "DELETED" },
      { id: "sub_b", status: "ACTIVE" },
    ])?.id === "sub_b",
    "reuse stored active",
  );
});
