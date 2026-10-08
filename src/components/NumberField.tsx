import React, { useEffect, useState } from 'react';

interface NumberFieldProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  placeholder?: string;
  className?: string;
  required?: boolean;
  /** When false (default) an empty field reports 0; when true it reports undefined. */
  allowEmpty?: boolean;
}

/**
 * Number input that keeps what you type as text, so values like "0.", ".75" or an
 * empty box don't get rewritten to 1 mid-typing.
 */
export const NumberField: React.FC<NumberFieldProps> = ({
  value,
  onChange,
  min = 0,
  placeholder,
  className,
  required,
  allowEmpty = false,
}) => {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));

  // Follow outside changes (e.g. the form resetting) but not our own typing
  useEffect(() => {
    const parsed = parseFloat(draft);
    const current = Number.isNaN(parsed) ? undefined : parsed;
    if (current !== value && !(current === undefined && (value === undefined || value === 0))) {
      setDraft(value === undefined ? '' : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={min}
      required={required}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (Number.isNaN(parsed)) onChange(allowEmpty ? undefined : 0);
        else onChange(Math.max(min, parsed));
      }}
      className={className}
    />
  );
};
