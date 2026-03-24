const formatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  minimumFractionDigits: 2,
});

export function formatCurrency(amountInCents: number): string {
  return formatter.format(amountInCents / 100);
}
