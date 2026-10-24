const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

/** Indian-grouped rupee amount, e.g. ₹7,50,000. */
export function formatINR(amount: number) {
  return inr.format(amount)
}
