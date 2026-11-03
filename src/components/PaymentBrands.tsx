/** Credit brands supported by Asaas. Labels are local: no third-party requests. */
export function PaymentBrands() {
  return <div className="payment-brands" aria-label="Bandeiras de crédito: Visa, Mastercard, Elo e American Express">
    <span className="payment-visa">VISA</span>
    <span><svg aria-hidden="true" width="30" height="20" viewBox="0 0 30 20"><circle cx="11" cy="10" r="9" fill="#eb001b"/><circle cx="20" cy="10" r="9" fill="#f79e1b" fillOpacity=".9"/></svg><span className="sr-only">Mastercard</span></span>
    <span className="payment-elo">elo</span><span className="payment-amex">AMERICAN<br/>EXPRESS</span>
  </div>
}
