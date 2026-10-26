import { describe, it, expect } from "vitest";
import {
  amountDue,
  cents,
  cashTotals,
  bookingTotal,
  selectedBookingTotal,
  periodStart,
} from "../finance";
import type { BookingWithDetails, FinancialTransaction } from "../types";
const b = {
  quoted_amount: 80,
  pet_transport_fee: 10,
  booking_services: [{ service_id: "a", services: { price: 60 } }],
} as BookingWithDetails;
const tx = (amount: number, type: "entrada" | "saida") =>
  ({ amount, type }) as FinancialTransaction;

describe("financial contract", () => {
  it("adds money in integer cents", () =>
    expect(cashTotals([tx(0.1, "entrada"), tx(0.2, "entrada")]).income).toBe(
      0.3,
    ));
  it("rejects nonfinite money", () => expect(() => cents(NaN)).toThrow());
  it("calculates income expenses and balance from ledger", () =>
    expect(cashTotals([tx(80, "entrada"), tx(10.25, "saida")])).toEqual({
      income: 80,
      expenses: 10.25,
      balance: 69.75,
    }));
  it("retains quote after catalogue changes", () =>
    expect(bookingTotal(b)).toBe(80));
  it("adds only new services to saved quote", () =>
    expect(
      selectedBookingTotal(
        b,
        new Set(["a", "b"]),
        [
          { id: "a", price: 999 },
          { id: "b", price: 20 },
        ],
        10,
      ),
    ).toBe(100));
  it("replaces transport fee once", () =>
    expect(
      selectedBookingTotal(b, new Set(["a"]), [{ id: "a", price: 999 }], 15),
    ).toBe(85));
  it("uses timezone-aware start of day", () => {
    const d = new Date(2026, 9, 26, 23, 59);
    expect(new Date(periodStart("today", d)).getHours()).toBe(0);
  });
  it("handles empty ledger", () => expect(cashTotals([]).balance).toBe(0));
});

describe('package settlement',()=>{it('charges only amounts outside the package',()=>expect(amountDue(100,80,true)).toBe(20));it('charges the quote without a package',()=>expect(amountDue(100,80,false)).toBe(100));it('never generates a negative charge',()=>expect(amountDue(70,80,true)).toBe(0))})
