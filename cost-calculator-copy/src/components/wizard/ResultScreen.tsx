import React, { useState } from 'react';
import { formatNZD } from '../../lib/calculator/engine';
import type { WizardAnswers, EstimateResult } from '../../lib/calculator/types';
import { getConfig } from '../../hooks/usePricing';

interface Props {
  answers: WizardAnswers;
  estimate: EstimateResult;
  leadId: number;
  email: string;
  firstName: string;
}

const SCENARIO_LABELS: Record<string, string> = {
  ground_level:       'Ground Level Fence',
  balcony_balustrade: 'Balcony / Patio Balustrade',
  premium_pool_fence: 'Premium Pool Fence',
  stair_balustrade:   'Stair Balustrade',
};

const GLASS_TYPE_LABELS: Record<string, string> = {
  toughened_12mm: '12mm Toughened + Capping',
  laminated:      'Laminated (no capping)',
};

const GLASS_COLOUR_LABELS: Record<string, string> = {
  clear:    'Clear',
  low_iron: 'Low Iron / Ultra-Clear',
  tinted:   'Tinted',
  frosted:  'Frosted Glass',
};

const FIXING_LABELS: Record<string, string> = {
  spigots:        'Spigots',
  standoff_posts: 'Stand-off posts',
  hidden_channel: 'Hidden channel',
  viking:         'Viking System',
  not_sure:       'To be confirmed',
};

const SUBSTRATE_LABELS: Record<string, string> = {
  timber:   'Timber',
  concrete: 'Concrete',
  tile:     'Tile',
  steel:    'Steel',
  not_sure: 'To be confirmed',
};

const FINISH_LABELS: Record<string, string> = {
  standard_chrome: 'Chrome',
  matte_black:     'Matt black',
  brushed_chrome:  'Brushed chrome',
  powder_coated:   'Powder coated',
  not_sure:        'To be confirmed',
};

export function ResultScreen({ answers, estimate, leadId, email, firstName }: Props) {
  const [emailInput, setEmailInput] = useState(email);
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);
  const [sendError,  setSendError]  = useState('');

  async function sendToEmail() {
    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setSendError('Please enter a valid email address.');
      return;
    }
    setSending(true);
    setSendError('');
    try {
      const config = getConfig();
      const res = await fetch(`${config.restUrl}/estimate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': config.nonce },
        body: JSON.stringify({ email: trimmed, firstName, leadId, answers, estimate }),
      });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
      } else {
        setSendError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setSendError('Unable to send. Please check your connection or call 0800 769 254.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {/* Estimate banner — or call us banner */}
      {estimate.needsCallUs ? (
        <div style={{
          background: '#fff8ef', border: '2px solid #f59e0b', borderRadius: '18px',
          padding: '34px 24px', textAlign: 'center', marginBottom: '24px',
        }}>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#92400e', marginBottom: '8px' }}>
            Custom Quote Required
          </div>
          <p style={{ margin: 0, color: '#78350f', fontSize: '15px' }}>
            Your project has site conditions that need a visit before we can estimate accurately.
            Royal Glass will contact you to arrange a free site assessment.
          </p>
        </div>
      ) : (
        <div style={{
          background: 'linear-gradient(135deg, #173755 0%, #1a3c5e 60%, #244a70 100%)',
          borderRadius: '18px', padding: '34px 24px', textAlign: 'center',
          marginBottom: '24px', color: 'white',
          boxShadow: '0 14px 34px rgba(26,60,94,0.26)',
        }}>
          <p style={{ fontSize: '13px', color: '#93c5fd', marginTop: 0, marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' as const, fontWeight: 600 }}>
            Your indicative estimate
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '12px 0' }}>
            <span style={{ fontSize: '36px', fontWeight: 700 }}>{formatNZD(estimate.low)}</span>

            <span style={{ fontSize: '24px', color: '#93c5fd' }}>–</span>
            <span style={{ fontSize: '36px', fontWeight: 700 }}>{formatNZD(estimate.high)}</span>
          </div>
          <p style={{ fontSize: '13px', color: '#93c5fd', margin: 0 }}>
            Excluding GST · Based on {estimate.effectiveLength}m effective length
          </p>
        </div>
      )}

            {/* Amber consultation bar */}
            {estimate.consultationFlags.length > 0 && (
        <div style={{
          background: '#fff8ef', border: '1px solid #f59e0b', borderRadius: '12px',
          padding: '16px 20px', marginBottom: '20px',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', margin: '0 0 8px' }}>
            Our team will confirm the following at the site visit:
          </p>
          {estimate.consultationFlags.map((flag) => (
            <p key={flag} style={{ fontSize: '13px', color: '#78350f', margin: '0 0 3px 0' }}>· {flag}</p>
          ))}
        </div>
      )}

      {/* Project summary */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginTop: 0, marginBottom: '12px' }}>Your project summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '14px' }}>
          {([
            ['Scenario',        SCENARIO_LABELS[answers.scenario ?? ''] ?? ''],
            ...(answers.scenario === 'stair_balustrade'
              ? [['Stair run', `${answers.length}m`] as [string, string], ['Landing area', `${answers.landingLength}m`] as [string, string]]
              : [['Length', `${answers.length}m`] as [string, string]]),
            ['Corners',         `${answers.corners}`],
            ['Gates',           answers.scenario === 'premium_pool_fence' ? `${answers.gates}` : 'N/A'],
            ['Glass type',      GLASS_TYPE_LABELS[answers.glassType ?? 'toughened_12mm'] ?? ''],
            ['Glass colour',    GLASS_COLOUR_LABELS[answers.glassColour] ?? ''],
            ['Fixing method',   FIXING_LABELS[answers.fixingMethod ?? ''] ?? ''],
            ['Substrate',       SUBSTRATE_LABELS[answers.substrate ?? ''] ?? ''],
            ['Hardware finish', FINISH_LABELS[answers.hardwareFinish ?? ''] ?? ''],
          ] as [string, string][]).map(([k, v]) => (
            <React.Fragment key={k}>
              <span style={{ color: '#6b7280' }}>{k}</span>
              <span style={{ fontWeight: 500, color: '#111' }}>{v}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Assumptions */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginTop: 0, marginBottom: '8px' }}>This estimate assumes:</h3>
        {[
          'Straight panels — no curved glass',
          'Ground-level access',
          'NZ standard height for selected scenario',
        ].map((a) => (
          <p key={a} style={{ fontSize: '13px', color: '#6b7280', marginTop: 0, marginBottom: '4px' }}>✓ {a}</p>
        ))}
        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px', marginBottom: 0 }}>
          Anything different? Our team will adjust the formal quote after the site visit.
        </p>
      </div>

      {/* What happens next */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginTop: 0, marginBottom: '16px' }}>What happens next</h3>
        {[
          { n: '1', title: 'We review your details',  body: 'Our team checks your project and contacts you within 1 business day.' },
          { n: '2', title: 'Site visit',               body: 'We visit to take precise measurements and confirm the scope.' },
          { n: '3', title: 'Confirmed quote',           body: 'You receive a detailed, fixed-price quote with timeline. No obligation.' },
        ].map((item) => (
          <div key={item.n} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1a3c5e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
              {item.n}
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#111', marginTop: 0, marginBottom: '2px' }}>{item.title}</p>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{item.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Send to email */}
      <div style={{ border: '1px solid #dbeafe', borderRadius: '14px', padding: '22px', marginBottom: '16px', background: '#f0f7ff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a3c5e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg style={{ width: '18px', height: '18px', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1a3c5e', marginTop: 0, marginBottom: '3px' }}>
              Share this estimate
            </h3>
            <p style={{ fontSize: '13px', color: '#3b82f6', margin: 0 }}>
              {firstName ? `A copy is on its way to ${firstName}'s inbox.` : 'A copy is on its way to your inbox.'} Forward to a builder, partner, or architect below.
            </p>
          </div>
        </div>

        {sent ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg style={{ width: '13px', height: '13px', color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#15803d', marginTop: 0, marginBottom: '2px' }}>Sent! Check your inbox.</p>
              <p style={{ fontSize: '12px', color: '#16a34a', margin: 0 }}>Can't find it? Check your spam folder, or call us on 0800 769 254.</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setSendError(''); }}
                placeholder="your@email.com"
                style={{
                  flex: 1, padding: '11px 14px',
                  border: `1px solid ${sendError ? '#f87171' : '#bfdbfe'}`,
                  borderRadius: '8px', fontSize: '14px', outline: 'none',
                  background: 'white', boxSizing: 'border-box' as const,
                }}
              />
              <button
                type="button"
                onClick={sendToEmail}
                disabled={sending}
                style={{
                  padding: '11px 22px', borderRadius: '8px', border: 'none',
                  background: sending ? '#9ca3af' : '#1a3c5e',
                  color: 'white', fontSize: '14px', fontWeight: 600,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {sending ? 'Sending…' : 'Send →'}
              </button>
            </div>
            {sendError && (
              <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px', marginBottom: 0 }}>{sendError}</p>
            )}
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', marginBottom: 0 }}>
              Enter a different address to forward to your builder, partner, or architect.
            </p>
          </>
        )}
      </div>

      {/* Call CTA */}
      <a href="tel:0800769254" style={{
        display: 'block', textAlign: 'center', padding: '14px',
        border: '1px solid #d1d5db', borderRadius: '8px',
        fontSize: '14px', color: '#374151', textDecoration: 'none', marginBottom: '12px',
      }}>
        Call us now: 0800 769 254
      </a>

      <button onClick={() => window.print()} style={{
        display: 'block', width: '100%', padding: '10px',
        border: '1px solid #e5e7eb', borderRadius: '8px',
        fontSize: '13px', color: '#9ca3af', background: 'white', cursor: 'pointer', marginBottom: '16px',
      }}>
        Save or print this estimate
      </button>

      <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
        This is an indicative estimate only. Final pricing is confirmed after a site visit. Prices exclude GST.
      </p>
    </div>
  );
}
