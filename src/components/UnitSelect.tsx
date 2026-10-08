import React from 'react';
import { useMeasureMode } from '../context/SettingsContext';
import { canonicalUnit, unitOptions } from '../utils/units';

interface UnitSelectProps {
  value: string;
  onChange: (unit: string) => void;
  className?: string;
  /** Show an empty "Unit" choice (for optional fields). */
  allowBlank?: boolean;
}

/** Dropdown of standardized units for the app's current measurement mode. */
export const UnitSelect: React.FC<UnitSelectProps> = ({ value, onChange, className, allowBlank }) => {
  const mode = useMeasureMode();
  const canon = value ? canonicalUnit(value) || 'count' : allowBlank ? '' : 'count';
  return (
    <select value={canon} onChange={(e) => onChange(e.target.value)} className={className}>
      {allowBlank && <option value="">Unit</option>}
      {unitOptions(mode, canon).map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
};
