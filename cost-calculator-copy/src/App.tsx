import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { WizardAnswers, LeadData, EstimateResult } from './lib/calculator/types';
import { calculateEstimate } from './lib/calculator/engine';
import { usePricing, getConfig } from './hooks/usePricing';
import { CalculatorForm } from './components/CalculatorForm';
import { LeadCapture } from './components/wizard/LeadCapture';
import { ResultScreen } from './components/wizard/ResultScreen';

const INITIAL_ANSWERS: WizardAnswers = {
  scenario: null,
  length: 10,
  landingLength: 0,
  corners: 0,
  gates: 0,
  glassType: null,
  glassColour: 'clear',
  interlikingRails: false,
  fixingMethod: null,
  substrate: null,
  hardwareFinish: null,
  callTriggers: [],
};

const INITIAL_LEAD: LeadData = {
  fullName: '',
  phone: '',
  email: '',
  customerType: null,
  timeframe: null,
  address: '',
  notes: '',
  consent: false,
  marketingConsent: false,
};

function loadTurnstile() {
  if (document.querySelector('[data-rg-turnstile]')) return;
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true;
  s.defer = true;
  s.setAttribute('data-rg-turnstile', '1');
  document.head.appendChild(s);
}

// Suppress unused variable warning — INITIAL_LEAD is the shape reference for LeadCapture
void INITIAL_LEAD;

export default function App() {
  const { pricing, loading } = usePricing();
  const loadedAt = useRef(Date.now());

  const [answers, setAnswers] = useState<WizardAnswers>(INITIAL_ANSWERS);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadInfo, setLeadInfo] = useState<{ leadId: number; email: string; firstName: string } | null>(null);

  useEffect(() => {
    const config = getConfig();
    if (config.turnstileSiteKey) loadTurnstile();
  }, []);

  const estimate: EstimateResult = useMemo(
    () => calculateEstimate(answers, pricing),
    [answers, pricing]
  );

  function updateAnswers(updates: Partial<WizardAnswers>) {
    setAnswers((prev) => ({ ...prev, ...updates }));
  }

  function handleLeadSuccess(leadId: number, email: string, firstName: string) {
    setLeadInfo({ leadId, email, firstName });
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px', color: '#9ca3af', fontSize: '14px' }}>
        Loading calculator...
      </div>
    );
  }

  // Result screen — shown after lead is successfully submitted
  if (leadInfo) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px', fontFamily: 'inherit' }}>
        <ResultScreen
          answers={answers}
          estimate={estimate}
          leadId={leadInfo.leadId}
          email={leadInfo.email}
          firstName={leadInfo.firstName}
        />
      </div>
    );
  }

  // Lead capture — shown when user clicks "Get my estimate"
  if (showLeadCapture) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px', fontFamily: 'inherit' }}>
        <LeadCapture
          answers={answers}
          estimate={estimate}
          loadedAt={loadedAt.current}
          onSuccess={handleLeadSuccess}
          onBack={() => setShowLeadCapture(false)}
        />
      </div>
    );
  }

  // Default: calculator step flow
  return (
    <CalculatorForm
      answers={answers}
      onChange={updateAnswers}
      onGetEstimate={() => setShowLeadCapture(true)}
    />
  );
}
