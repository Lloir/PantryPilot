export interface CurrencyOption {
  code: string;
  name: string;
}

// Shown in the menu. Amounts are stored as plain numbers; the currency only changes how they are displayed.
export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'AED', name: 'UAE Dirham' },
];

export const DEFAULT_CURRENCY = 'USD';

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(code: string): Intl.NumberFormat {
  let f = formatters.get(code);
  if (!f) {
    try {
      f = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' });
    } catch {
      f = new Intl.NumberFormat('en-US', { style: 'currency', currency: DEFAULT_CURRENCY });
    }
    formatters.set(code, f);
  }
  return f;
}

/** 12.5 -> "$12.50", "£12.50", "¥13" depending on the chosen currency. */
export function formatMoney(amount: number, code: string = DEFAULT_CURRENCY): string {
  return formatterFor(code).format(Number.isFinite(amount) ? amount : 0);
}

/** Just the symbol, for form labels like "Total Cost (£)". */
export function currencySymbol(code: string = DEFAULT_CURRENCY): string {
  return formatterFor(code).formatToParts(0).find(p => p.type === 'currency')?.value ?? code;
}
