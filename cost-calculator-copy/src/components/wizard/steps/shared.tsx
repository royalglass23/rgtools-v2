import React from 'react';

// ─── Selection card (image + title + description) ─────────────────────────────

interface SelectionCardProps {
  image?: string;
  imageAlt?: string;
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  badge?: string;
  compact?: boolean;
  swatch?: string;
}

export function SelectionCard({
  image,
  imageAlt,
  title,
  description,
  selected,
  onSelect,
  badge,
  compact = false,
  swatch,
}: SelectionCardProps) {
  const [hovered, setHovered] = React.useState(false);

  const borderColor = selected ? '#1a3c5e' : hovered ? '#c4cdd6' : '#e6eaef';
  const boxShadow = selected
    ? '0 8px 24px rgba(26,60,94,0.12)'
    : hovered
    ? '0 6px 16px rgba(15,23,42,0.06)'
    : 'none';

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={selected}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '16px',
        border: `1px solid ${borderColor}`,
        background: 'white',
        textAlign: 'left',
        cursor: 'pointer',
        outline: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow,
        padding: compact ? '12px' : 0,
        width: '100%',
      }}
    >
      {swatch ? (
        <div
          style={{
            width: '100%',
            height: compact ? '64px' : '128px',
            borderRadius: '8px',
            marginBottom: '8px',
            background: swatch,
          }}
          aria-hidden="true"
        />
      ) : image ? (
        <div style={{ width: '100%', height: compact ? '132px' : '196px', overflow: 'hidden' }}>
          <img
            src={image}
            alt={imageAlt ?? title}
            style={{ height: '100%', width: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: (image || swatch) ? '12px' : '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>{title}</span>
          {badge && (
            <span style={{
              borderRadius: '999px',
              background: '#dcfce7',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 500,
              color: '#15803d',
            }}>
              {badge}
            </span>
          )}
          {selected && (
            <span style={{
              marginLeft: 'auto',
              display: 'flex',
              width: '20px',
              height: '20px',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: '#1a3c5e',
              flexShrink: 0,
            }}>
              <svg style={{ width: '12px', height: '12px', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </div>
        {description && (
          <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6, margin: 0, padding: 0 }}>{description}</p>
        )}
      </div>
    </button>
  );
}

// ─── Slider + manual input combo ─────────────────────────────────────────────

interface SliderInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
  label?: string;
}

export function SliderInput({ value, min, max, step = 1, unit, onChange, label }: SliderInputProps) {
  const [inputStr, setInputStr] = React.useState(String(value));

  React.useEffect(() => {
    setInputStr(String(value));
  }, [value]);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value));

  const handleText = (e: React.ChangeEvent<HTMLInputElement>) => setInputStr(e.target.value);

  const handleTextBlur = () => {
    const parsed = parseInt(inputStr, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
      setInputStr(String(clamped));
    } else {
      setInputStr(String(value));
    }
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleTextBlur();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {label && <span style={{ fontSize: '12px', color: '#6b7280' }}>{label}</span>}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: 'center' }}>
        <span style={{ fontSize: '48px', fontWeight: 700, color: '#1a3c5e', fontVariantNumeric: 'tabular-nums' as const }}>{value}</span>
        <span style={{ fontSize: '20px', color: '#9ca3af' }}>{unit}</span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleSlider}
        style={{ width: '100%', accentColor: '#1a3c5e' } as React.CSSProperties}
        aria-label={`${unit} slider`}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af' }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px', color: '#6b7280' }}>Or type a number:</span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          borderRadius: '8px', border: '1px solid #d1d5db', padding: '6px 12px',
        }}>
          <input
            type="number"
            min={min}
            max={max}
            value={inputStr}
            onChange={handleText}
            onBlur={handleTextBlur}
            onKeyDown={handleTextKeyDown}
            style={{ width: '64px', textAlign: 'center', fontSize: '14px', fontWeight: 500, outline: 'none', background: 'transparent', border: 'none' }}
            aria-label={`Enter ${unit} manually`}
          />
          <span style={{ fontSize: '14px', color: '#9ca3af' }}>{unit}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Step note/helper box ─────────────────────────────────────────────────────

export function StepNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '8px', borderRadius: '12px', background: '#f5f8fc', border: '1px solid #dbe4ef', padding: '12px', fontSize: '14px', color: '#244160' }}>
      <svg style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

// ─── Compliance warning ───────────────────────────────────────────────────────

export function ComplianceWarning({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '8px', borderRadius: '12px', background: '#fff8ef', border: '1px solid #f8ddb6', padding: '12px', fontSize: '14px', color: '#8a4f0f' }}>
      <svg style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

// ─── Step hero image ──────────────────────────────────────────────────────────

export function StepHero({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{ width: '100%', height: '260px', overflow: 'hidden', borderRadius: '12px', marginBottom: '24px' }}>
      <img
        src={src}
        alt={alt}
        style={{ height: '100%', width: '100%', objectFit: 'cover', display: 'block' }}
        loading="lazy"
      />
    </div>
  );
}
