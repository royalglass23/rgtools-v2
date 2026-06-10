import React, { useRef, useState } from 'react';
import type { LeadData, WizardAnswers, EstimateResult, CustomerType, Timeframe } from '../../lib/calculator/types';
import { getConfig } from '../../hooks/usePricing';
import { NZAddressAutocomplete } from './NZAddressAutocomplete';

const s = (base: React.CSSProperties): React.CSSProperties => base;

const NZ_PHONE = /^(\+?64[\s-]?)?(\(?0?[2-9]\d?\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, o: Record<string, unknown>) => string;
      remove: (id: string) => void;
      execute: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: 'homeowner',    label: 'Homeowner' },
  { value: 'builder',      label: 'Builder' },
  { value: 'developer',    label: 'Developer' },
  { value: 'architect',    label: 'Architect' },
  { value: 'pool_builder', label: 'Pool Builder' },
  { value: 'other',        label: 'Other' },
];

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: 'asap',          label: 'ASAP' },
  { value: '1_3_months',    label: '1–3 months' },
  { value: '3_6_months',    label: '3–6 months' },
  { value: '6_plus_months', label: '6+ months' },
  { value: 'just_planning', label: 'Just planning / budgeting' },
];

interface Props {
  answers: WizardAnswers;
  estimate: EstimateResult;
  loadedAt: number;
  onSuccess: (leadId: number, email: string, firstName: string) => void;
  onBack: () => void;
}

export function LeadCapture({ answers, estimate, loadedAt, onSuccess, onBack }: Props) {
  function cleanPhoneInput(raw: string): string {
    return raw.replace(/[^0-9+\s().-]/g, '');
  }

  const [lead, setLead] = useState<LeadData>({
    fullName: '', phone: '', email: '',
    customerType: null, timeframe: null,
    address: '', notes: '', consent: false, marketingConsent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const turnstileToken = useRef('');
  const tokenWaiters = useRef<Array<(token: string) => void>>([]);
  const honeypotRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!turnstileRef.current) return;
    const config = getConfig();
    if (!config.turnstileSiteKey) return;

    let cleanupFn: (() => void) | undefined;

    function initWidget() {
      if (!turnstileRef.current || !window.turnstile || turnstileWidgetId.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: config.turnstileSiteKey,
        callback: (t: string) => {
          turnstileToken.current = t;
          tokenWaiters.current.forEach((resolve) => resolve(t));
          tokenWaiters.current = [];
        },
        'expired-callback': () => { turnstileToken.current = ''; },
        size: 'invisible',
        appearance: 'interaction-only',
      });
      cleanupFn = () => {
        if (turnstileWidgetId.current && window.turnstile) {
          window.turnstile.remove(turnstileWidgetId.current);
          turnstileWidgetId.current = null;
        }
      };
    }

    if (window.turnstile) {
      initWidget();
      return () => cleanupFn?.();
    }

    // Script still loading — poll until window.turnstile is available
    const interval = window.setInterval(() => {
      if (window.turnstile) {
        window.clearInterval(interval);
        initWidget();
      }
    }, 200);

    return () => {
      window.clearInterval(interval);
      cleanupFn?.();
    };
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!lead.fullName.trim()) e.fullName = 'Name is required';
    if (!lead.phone.trim()) e.phone = 'Phone number is required';
    else if (!NZ_PHONE.test(lead.phone.replace(/\s/g, ''))) e.phone = 'Enter a valid NZ phone number';
    if (!lead.email.trim()) e.email = 'Email is required';
    else if (!EMAIL_RE.test(lead.email)) e.email = 'Enter a valid email address';
    if (!lead.customerType) e.customerType = 'Please select one';
    if (!lead.timeframe) e.timeframe = 'Please select one';
    if (!lead.address.trim()) e.address = 'Project address is required';
    if (!lead.consent) e.consent = 'Please agree to be contacted';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function ensureTurnstileToken(): Promise<boolean> {
    const config = getConfig();
    if (!config.turnstileSiteKey) return true;
    if (turnstileToken.current) return true;
    if (!window.turnstile || !turnstileWidgetId.current) {
      setServerError('Security check is still loading. Please wait a moment and try again.');
      return false;
    }

    const tokenPromise = new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('timeout')), 8000);
      tokenWaiters.current.push((token) => {
        window.clearTimeout(timeout);
        resolve(token);
      });
    });

    try {
      window.turnstile.reset(turnstileWidgetId.current);
      window.turnstile.execute(turnstileWidgetId.current);
      await tokenPromise;
      return !!turnstileToken.current;
    } catch {
      setServerError('Security check failed to load. Please reload the page and try again.');
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (honeypotRef.current?.value) return;
    const hasToken = await ensureTurnstileToken();
    if (!hasToken) return;
    setSubmitting(true);
    setServerError('');
    try {
      const config = getConfig();
      const [firstName, ...restNames] = lead.fullName.trim().split(/\s+/);
      const payloadLead = {
        firstName: firstName ?? '',
        lastName: restNames.join(' ').trim(),
        phone: lead.phone,
        email: lead.email,
        customerType: lead.customerType ?? '',
        address: lead.address,
        callPreference: 'anytime',
        notes: lead.notes.trim(),
        consent: lead.consent,
        websiteUrl: honeypotRef.current?.value ?? '',
      };
      const res = await fetch(`${config.restUrl}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': config.nonce },
        body: JSON.stringify({ answers, lead: payloadLead, estimate, turnstileToken: turnstileToken.current, loadedAt }),
      });
      const data = await res.json();
      if (data.ok) onSuccess(data.leadId ?? 0, lead.email, firstName ?? '');
      else setServerError(data.error ?? 'Something went wrong. Please try again.');
    } catch {
      setServerError('Unable to submit. Please check your connection or call 0800 769 254.');
    } finally {
      setSubmitting(false);
    }
  }

  const chip = (
    label: string,
    selected: boolean,
    onClick: () => void,
    error?: boolean
  ) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 14px',
        borderRadius: '8px',
        border: `2px solid ${selected ? '#1a3c5e' : error ? '#f87171' : '#e5e7eb'}`,
        background: selected ? '#eef2f7' : 'white',
        fontSize: '14px',
        fontWeight: selected ? 600 : 400,
        color: selected ? '#1a3c5e' : '#374151',
        cursor: 'pointer',
        textAlign: 'left' as const,
      }}
    >
      {label}
    </button>
  );

  const inputStyle = (err?: string): React.CSSProperties => ({
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${err ? '#f87171' : '#d1d5db'}`,
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  });

  const label = (text: string, required?: boolean) => (
    <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
      {text}{required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
    </div>
  );

  const errMsg = (key: string) => errors[key]
    ? <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors[key]}</p>
    : null;

  return (
    <div style={{ position: 'relative' }}>
      <style>{`@keyframes rg-spin { to { transform: rotate(360deg); } }`}</style>

      {submitting && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(255,255,255,0.92)',
          borderRadius: '12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            border: '4px solid #e5e7eb',
            borderTopColor: '#1a3c5e',
            animation: 'rg-spin 0.8s linear infinite',
          }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '16px', fontWeight: 600, color: '#111', margin: 0 }}>
              Preparing your estimate…
            </p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
              This usually takes a few seconds
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>
        Almost there!
      </h2>
      <p style={{ fontSize: '15px', color: '#6b7280', marginBottom: '32px', lineHeight: 1.5 }}>
        We'll show your indicative range and forward your details to Royal Glass.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {/* Honeypot */}
        <input ref={honeypotRef} type="text" name="website_url" tabIndex={-1} aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Full name / Company name */}
          <div>
            {label('Full name / Company name', true)}
            <input type="text" autoComplete="name" placeholder="Sarah Johnson or Smith Builders Ltd"
              style={inputStyle(errors.fullName)} value={lead.fullName}
              onChange={e => { setLead(p => ({ ...p, fullName: e.target.value })); setErrors(p => ({ ...p, fullName: '' })); }}
            />
            {errMsg('fullName')}
          </div>

          {/* Email + Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              {label('Email', true)}
              <input type="email" autoComplete="email" placeholder="sarah@example.com"
                style={inputStyle(errors.email)} value={lead.email}
                onChange={e => { setLead(p => ({ ...p, email: e.target.value })); setErrors(p => ({ ...p, email: '' })); }}
              />
              {errMsg('email')}
            </div>
            <div>
              {label('Phone', true)}
              <input type="tel" autoComplete="tel" inputMode="numeric" placeholder="e.g. 021 123 4567"
                style={inputStyle(errors.phone)} value={lead.phone}
                onChange={e => {
                  const cleaned = cleanPhoneInput(e.target.value);
                  setLead(p => ({ ...p, phone: cleaned }));
                  setErrors(p => ({ ...p, phone: '' }));
                }}
              />
              {errMsg('phone')}
            </div>
          </div>

          {/* I'm a... + Timeframe */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              {label("I'm a...", true)}
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
                {CUSTOMER_TYPES.map(t => chip(t.label, lead.customerType === t.value, () => {
                  setLead(p => ({ ...p, customerType: t.value }));
                  setErrors(p => ({ ...p, customerType: '' }));
                }, !!errors.customerType))}
              </div>
              {errMsg('customerType')}
            </div>
            <div>
              {label('Timeframe', true)}
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
                {TIMEFRAMES.map(t => chip(t.label, lead.timeframe === t.value, () => {
                  setLead(p => ({ ...p, timeframe: t.value }));
                  setErrors(p => ({ ...p, timeframe: '' }));
                }, !!errors.timeframe))}
              </div>
              {errMsg('timeframe')}
            </div>
          </div>

          {/* Address */}
          <div>
            {label('Project address', true)}
            <NZAddressAutocomplete
              value={lead.address}
              onChange={v => { setLead(p => ({ ...p, address: v })); setErrors(p => ({ ...p, address: '' })); }}
              error={errors.address}
            />
          </div>

          {/* Additional info */}
          <div>
            {label('Anything else we should know? (optional)')}
            <textarea
              value={lead.notes}
              onChange={e => setLead(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. pool fence needs a self-closing gate, balcony is on the second floor, access is through a narrow gate…"
              rows={3}
              style={{
                ...inputStyle(),
                resize: 'vertical' as const,
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Consent */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={lead.consent}
                onChange={e => { setLead(p => ({ ...p, consent: e.target.checked })); setErrors(p => ({ ...p, consent: '' })); }}
                style={{ marginTop: '2px', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
                I agree Royal Glass may contact me about my enquiry and store my details for that purpose. <span style={{ color: '#ef4444' }}>*</span>
              </span>
            </label>
            {errMsg('consent')}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={lead.marketingConsent}
                onChange={e => setLead(p => ({ ...p, marketingConsent: e.target.checked }))}
                style={{ marginTop: '2px', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                I'd also like occasional updates from Royal Glass. (optional)
              </span>
            </label>
          </div>

          {/* Disclaimer */}
          <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.5 }}>
            ⓘ This is an indicative starting estimate, not a formal quote. Final pricing is confirmed by Royal Glass after a site visit.
          </p>

          {/* Turnstile */}
          <div ref={turnstileRef} />

          {/* Server error */}
          {serverError && (
            <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '14px', color: '#dc2626' }}>
              {serverError}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" onClick={onBack}
            style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
            ← Back
          </button>
          <button type="submit" disabled={submitting}
            style={{
              padding: '12px 28px',
              borderRadius: '8px',
              border: 'none',
              background: submitting ? '#9ca3af' : '#1a3c5e',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? 'Submitting...' : 'Show my estimate →'}
          </button>
        </div>
      </form>
    </div>
  );
}
