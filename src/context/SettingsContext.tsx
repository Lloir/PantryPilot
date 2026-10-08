import React, { createContext, useContext, useMemo } from 'react';
import { MeasureMode } from '../utils/units';
import { DEFAULT_CURRENCY, currencySymbol, formatMoney } from '../utils/currency';

interface SettingsContextValue {
  measureMode: MeasureMode;
  currency: string;
  /** Formats an amount in the chosen currency, e.g. fmt(3.5) -> "£3.50". */
  fmt: (amount: number) => string;
  /** Symbol for form labels, e.g. "£". */
  symbol: string;
}

const SettingsContext = createContext<SettingsContextValue>({
  measureMode: 'mass',
  currency: DEFAULT_CURRENCY,
  fmt: (n) => formatMoney(n, DEFAULT_CURRENCY),
  symbol: currencySymbol(DEFAULT_CURRENCY),
});

export const SettingsProvider: React.FC<{
  measureMode: MeasureMode;
  currency: string;
  children: React.ReactNode;
}> = ({ measureMode, currency, children }) => {
  const value = useMemo<SettingsContextValue>(
    () => ({
      measureMode,
      currency,
      fmt: (n) => formatMoney(n, currency),
      symbol: currencySymbol(currency),
    }),
    [measureMode, currency]
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useMeasureMode = () => useContext(SettingsContext).measureMode;
export const useCurrency = () => useContext(SettingsContext);
