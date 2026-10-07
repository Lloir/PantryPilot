import React from 'react';
import { useMeasureMode } from '../context/SettingsContext';
import { canonicalUnit, unitOptions } from '../utils/units';

interface UnitSelectProps {
  value: string;
  onChange: (unit: string) => void;
  className?: string;
}

/** Dropdown of standardized units for the app's current measurement mode. */
export const UnitSelect: React.FC<UnitSelectProps> = ({ value, onChange, className }) => {
  const mode = useMeasureMode();
  const canon = canonicalUnit(value) || 'count';
  return (
    <select value={canon} onChange={(e) => onChange(e.target.value)} className={className}>
      {unitOptions(mode, canon).map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
};
