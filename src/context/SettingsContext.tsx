import React, { createContext, useContext } from 'react';
import { MeasureMode } from '../utils/units';

interface SettingsContextValue {
  measureMode: MeasureMode;
}

const SettingsContext = createContext<SettingsContextValue>({ measureMode: 'mass' });

export const SettingsProvider: React.FC<{ measureMode: MeasureMode; children: React.ReactNode }> = ({
  measureMode,
  children,
}) => <SettingsContext.Provider value={{ measureMode }}>{children}</SettingsContext.Provider>;

export const useMeasureMode = () => useContext(SettingsContext).measureMode;
