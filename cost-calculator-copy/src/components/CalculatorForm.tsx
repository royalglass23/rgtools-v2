import React, { useState } from "react";
import type {
  WizardAnswers,
  Scenario,
  GlassType,
  GlassColour,
  FixingMethod,
  SubstrateType,
  HardwareFinish,
} from "../lib/calculator/types";
import { IMAGES } from "../lib/calculator/config";
import { SelectionCard, SliderInput, StepNote, ComplianceWarning, StepHero } from "./wizard/steps/shared";

interface Props {
  answers: WizardAnswers;
  onChange: (updates: Partial<WizardAnswers>) => void;
  onGetEstimate: () => void;
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "#1a3c5e",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: "700",
            flexShrink: 0,
          }}
        >
          {number}
        </div>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#1a3c5e" }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

const SCENARIOS: Array<{ value: Scenario; title: string; description: string; image: string }> = [
  {
    value: "ground_level",
    title: "Ground Level Fence",
    description: "Outdoor area or pool — height ≤1m — standard residential",
    image: IMAGES.groundLevel,
  },
  {
    value: "balcony_balustrade",
    title: "Balcony / Patio Balustrade",
    description: "Elevated deck, balcony or patio — height >1m (NZBC 1m minimum)",
    image: IMAGES.balcony,
  },
  {
    value: "premium_pool_fence",
    title: "Premium Pool Fence",
    description: "Pool barrier — NZ Pool Safety Act — 1.2m minimum height",
    image: IMAGES.pool,
  },
  {
    value: "stair_balustrade",
    title: "Stair Balustrade",
    description: "Glass panels along stairs — NZBC stair safety code",
    image: IMAGES.stairs,
  },
];

const GLASS_TYPES: Array<{ value: GlassType; title: string; description: string; image: string; badge?: string }> = [
  {
    value: "toughened_12mm",
    title: "12mm Toughened + Capping",
    description: "Standard for balconies and stairs — durable, NZBC compliant",
    image: IMAGES.toughened,
    badge: "STANDARD",
  },
  {
    value: "laminated",
    title: "Laminated Glass",
    description: "No capping required — holds together if broken, suits certain designs",
    image: IMAGES.laminated,
    badge: "PREMIUM",
  },
];

const GLASS_COLOURS: Array<{ value: GlassColour; title: string; description: string; image: string; badge?: string }> = [
  {
    value: "clear",
    title: "Clear",
    description: "Standard clear glass — included in base price",
    image: IMAGES.colourClear,
    badge: "STANDARD",
  },
  {
    value: "tinted",
    title: "Tinted Glass",
    description: "Grey, bronze, or blue-green — privacy and style",
    image: IMAGES.colourTinted,
  },
  {
    value: "frosted",
    title: "Frosted Glass",
    description: "Diffused light, privacy without full opacity",
    image: IMAGES.colourFrosted,
  },
  {
    value: "low_iron",
    title: "Low Iron / Ultra-Clear",
    description: "Minimal green tint — truer colour transparency",
    image: IMAGES.colourLowIron,
  },
];

const FIXING_OPTIONS: Array<{ value: FixingMethod; title: string; description: string; image: string }> = [
  {
    value: "spigot_round",
    title: "Spigot Round",
    description: "Round posts drilled into the floor — available as sp10, sp13, and sp14",
    image: IMAGES.spigotRound,
  },
  {
    value: "standoff_posts",
    title: "Stand-off Posts",
    description: "Bracket-mounted on the face of the structure",
    image: IMAGES.standoff,
  },
  {
    value: "viking",
    title: "Viking System",
    description: "Top-clamping posts — no floor drilling required",
    image: IMAGES.viking,
  },
  {
    value: "jh_clamps",
    title: "JH Clamps",
    description: "Adjustable JH clamp system for securing glass panels",
    image: IMAGES.jhClamps,
  },
  {
    value: "side_channel",
    title: "Side Channel",
    description: "Glass secured via a channel mounted to the side of the structure",
    image: IMAGES.sideChannel,
  },
  {
    value: "top_channel",
    title: "Top Channel",
    description: "Glass secured via a channel mounted along the top",
    image: IMAGES.topChannel,
  },
  {
    value: "aluminium_1",
    title: "Aluminium 1",
    description: "Aluminium framing system — type 1 configuration",
    image: IMAGES.aluminiumOne,
  },
  {
    value: "aluminium_2",
    title: "Aluminium 2",
    description: "Aluminium framing system — type 2 configuration",
    image: IMAGES.aluminiumTwo,
  },
  {
    value: "sed",
    title: "SED",
    description: "Special Engineer Design — custom solution, our team will be in touch to discuss requirements",
    image: IMAGES.sed,
  },
];

const SUBSTRATE_OPTIONS: Array<{ value: SubstrateType; title: string; description: string; image: string }> = [
  { value: "timber",   title: "Timber",   description: "Decking, joists or timber framing",         image: IMAGES.substrateTimber },
  { value: "concrete", title: "Concrete", description: "Poured concrete slab or posts",             image: IMAGES.substrateConcrete },
  { value: "tile",     title: "Tile",     description: "Tiled surface — pool surrounds, balconies", image: IMAGES.substrateTile },
  { value: "steel",    title: "Steel",    description: "Steel frame or structural steel",            image: IMAGES.substrateSteel },
  { value: "not_sure", title: "Not Sure", description: "Our team will confirm on site",              image: IMAGES.notSure },
];

const FINISH_OPTIONS: Array<{ value: HardwareFinish; title: string; description: string; image: string; surcharge?: string; badge?: string }> = [
  {
    value: "standard_chrome",
    title: "Chrome",
    description: "Included in base price",
    image: IMAGES.chrome,
    badge: "STANDARD",
  },
  {
    value: "matte_black",
    title: "Matte Black",
    description: "Most popular premium finish",
    image: IMAGES.matteBlack,
  },
  {
    value: "brushed_chrome",
    title: "Brushed Chrome",
    description: "Subtle step up from standard",
    image: IMAGES.brushedChrome,
  },
  {
    value: "powder_coated",
    title: "Powder Coated",
    description: "Durable colour coating — range of colours available",
    image: IMAGES.powderCoated,
  },
  {
    value: "not_sure",
    title: "Not Sure",
    description: "Team will help you choose on site",
    image: IMAGES.notSure,
  },
];

export function CalculatorForm({ answers, onChange, onGetEstimate }: Props) {
  const [activeStep, setActiveStep] = useState(0);

  const gatesHidden     = answers.scenario !== "premium_pool_fence";
  const glassTypeHidden = answers.scenario === "ground_level" || answers.scenario === "premium_pool_fence";
  const cornersHidden   = answers.scenario === "stair_balustrade";

  function handleScenarioChange(value: Scenario) {
    const updates: Partial<WizardAnswers> = { scenario: value };
    if (value === "stair_balustrade") {
      updates.gates = 0;
      updates.corners = 0;
      updates.glassType = null;
    } else if (value === "premium_pool_fence") {
      if (answers.gates === 0) updates.gates = 1;
      updates.glassType = "toughened_12mm";
      updates.interlikingRails = false;
      updates.landingLength = 0;
    } else if (value === "ground_level") {
      updates.gates = 0;
      updates.glassType = "toughened_12mm";
      updates.interlikingRails = false;
      updates.landingLength = 0;
    } else {
      updates.gates = 0;
      updates.glassType = null;
      updates.landingLength = 0;
    }
    onChange(updates);
  }

  function handleGlassTypeChange(value: GlassType) {
    const updates: Partial<WizardAnswers> = { glassType: value };
    if (value === "toughened_12mm") {
      updates.interlikingRails = true;
    } else if (value === "laminated") {
      updates.interlikingRails = false;
    }
    onChange(updates);
  }

  const steps = [
    {
      title: "What's your project?",
      canContinue: answers.scenario !== null,
      content: (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
          {SCENARIOS.map((scenario) => (
            <SelectionCard
              key={scenario.value}
              image={scenario.image}
              title={scenario.title}
              description={scenario.description}
              selected={answers.scenario === scenario.value}
              onSelect={() => handleScenarioChange(scenario.value)}
            />
          ))}
        </div>
      ),
    },
    {
      title: "Total length of glass run",
      canContinue: true,
      content: (
        <>
          <StepHero src={IMAGES.balcony} alt="Glass fencing project" />
          <StepNote>Sample image for illustration purposes only. Actual product and installation may vary.</StepNote>
          {answers.scenario === "stair_balustrade" ? (
            <>
              <SliderInput
                label="Stair run"
                value={answers.length}
                min={1}
                max={100}
                step={1}
                unit="m"
                onChange={(value) => onChange({ length: value })}
              />
              <SliderInput
                label="Landing area"
                value={answers.landingLength}
                min={0}
                max={50}
                step={1}
                unit="m"
                onChange={(value) => onChange({ landingLength: value })}
              />
              <StepNote>Total {answers.length + answers.landingLength}m will be priced</StepNote>
            </>
          ) : (
            <>
              <SliderInput
                label="Metres"
                value={answers.length}
                min={1}
                max={100}
                step={1}
                unit="m"
                onChange={(value) => onChange({ length: value })}
              />
              {answers.length < 5 && (
                <StepNote>Minimum job is 5 m — shorter runs are charged as 5 m.</StepNote>
              )}
            </>
          )}
        </>
      ),
    },
    ...(!cornersHidden ? [{
      title: "How many corners?",
      canContinue: true,
      content: (
        <>
          <StepHero src={IMAGES.corners} alt="How to count corners" />
          <StepNote>Sample image for illustration purposes only. Actual product and installation may vary.</StepNote>
          <SliderInput
            label="Corners"
            value={answers.corners}
            min={0}
            max={10}
            step={1}
            unit=""
            onChange={(value) => onChange({ corners: value })}
          />
          <StepNote>Count every 90° turn in the glass run.</StepNote>
        </>
      ),
    }] : []),
    ...(!gatesHidden ? [{
      title: "How many gates?",
      canContinue: true,
      content: (
        <>
          <StepHero src={IMAGES.gates} alt="Frameless glass pool gate with self-closing latch" />
          <StepNote>Sample image for illustration purposes only. Actual product and installation may vary.</StepNote>
          <SliderInput
            label="Gates"
            value={answers.gates}
            min={0}
            max={6}
            step={1}
            unit=""
            onChange={(value) => onChange({ gates: value })}
          />
          <StepNote>
            NZ Pool Safety Act requires at least 1 self-closing, lockable gate on all pool fences. We use high-quality stainless steel gate hardware on all pool fence installations.
          </StepNote>
          {answers.gates === 0 && (
            <ComplianceWarning>
              You've set 0 gates — this may not meet NZ Pool Safety Act requirements. If access is via another compliant barrier (e.g. a locked door), zero gates is acceptable.
            </ComplianceWarning>
          )}
        </>
      ),
    }] : []),
    ...(!glassTypeHidden ? [{
      title: "Glass type",
      canContinue: answers.glassType !== null,
      content: (
        <>
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280" }}>
            Toughened glass includes a capping rail at the top. Laminated glass bonds two layers and needs no capping.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
            {GLASS_TYPES.map((opt) => (
              <SelectionCard
                key={opt.value}
                image={opt.image}
                title={opt.title}
                description={opt.description}
                selected={answers.glassType === opt.value}
                onSelect={() => handleGlassTypeChange(opt.value)}
                badge={opt.badge}
              />
            ))}
          </div>
        </>
      ),
    }] : []),
    {
      title: "Glass colour",
      canContinue: true,
      content: (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
          {GLASS_COLOURS.map((opt) => (
            <SelectionCard
              key={opt.value}
              image={opt.image}
              title={opt.title}
              description={opt.description}
              selected={answers.glassColour === opt.value}
              onSelect={() => onChange({ glassColour: opt.value as GlassColour })}
              badge={opt.badge}
              compact
            />
          ))}
        </div>
      ),
    },
    {
      title: "How will the glass be fixed?",
      canContinue: answers.fixingMethod !== null,
      content: (
        <>
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280" }}>
            Choose your preferred fixing method. Our team will confirm suitability on site.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
            {FIXING_OPTIONS.map((option) => (
              <SelectionCard
                key={option.value}
                image={option.image}
                title={option.title}
                description={option.description}
                selected={answers.fixingMethod === option.value}
                onSelect={() => onChange({ fixingMethod: option.value })}
                compact
              />
            ))}
          </div>
        </>
      ),
    },
    {
      title: "What is the substrate?",
      canContinue: answers.substrate !== null,
      content: (
        <>
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280" }}>
            The material the glass will be fixed into or onto. This helps us plan the right fixing detail.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
            {SUBSTRATE_OPTIONS.map((opt) => (
              <SelectionCard
                key={opt.value}
                image={opt.image}
                title={opt.title}
                description={opt.description}
                selected={answers.substrate === opt.value}
                onSelect={() => onChange({ substrate: opt.value as SubstrateType })}
                compact
              />
            ))}
          </div>
        </>
      ),
    },
    {
      title: "Hardware finish",
      canContinue: answers.hardwareFinish !== null,
      content: (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
          {FINISH_OPTIONS.map((option) => (
            <SelectionCard
              key={option.value}
              image={option.image}
              title={option.title}
              description={`${option.description}${option.surcharge ? ` — ${option.surcharge}` : ""}`}
              selected={answers.hardwareFinish === option.value}
              onSelect={() => onChange({ hardwareFinish: option.value })}
              badge={option.badge}
              compact
            />
          ))}
        </div>
      ),
    },
  ];

  const currentStep = steps[Math.min(activeStep, steps.length - 1)];
  const isLastStep = activeStep === steps.length - 1;
  const progressPercent = Math.round(((activeStep + 1) / steps.length) * 100);

  function goBack() {
    setActiveStep((step) => Math.max(0, step - 1));
  }

  function goForward() {
    if (!currentStep.canContinue) return;
    if (isLastStep) onGetEstimate();
    else setActiveStep((step) => Math.min(steps.length - 1, step + 1));
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px 16px", fontFamily: "inherit" }}>
      <div style={{ marginBottom: "40px", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: "800", color: "#1a3c5e" }}>
          Get a Glass Estimate
        </h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "15px" }}>
          Answer a few questions, enter your details, and then view your indicative estimate.
        </p>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#1a3c5e" }}>
            Step {activeStep + 1} of {steps.length}
          </span>
          <span style={{ fontSize: "12px", color: "#6b7280" }}>{progressPercent}%</span>
        </div>
        <div style={{ height: "6px", width: "100%", background: "#e6eaef", borderRadius: "999px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: "#1a3c5e",
              borderRadius: "999px",
              transition: "width 0.25s ease",
            }}
          />
        </div>
      </div>

      <Section number={activeStep + 1} title={currentStep.title}>
        {currentStep.content}
      </Section>

      <div
        style={{
          borderTop: "2px solid #e6eaef",
          paddingTop: "24px",
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <button
          type="button"
          onClick={goBack}
          disabled={activeStep === 0}
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            background: "white",
            color: activeStep === 0 ? "#9ca3af" : "#1a3c5e",
            border: "1px solid #d1d5db",
            cursor: activeStep === 0 ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "700",
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={goForward}
          disabled={!currentStep.canContinue}
          style={{
            flex: 1,
            padding: "14px 18px",
            borderRadius: "10px",
            background: currentStep.canContinue ? "#1a3c5e" : "#9ca3af",
            color: "white",
            border: "none",
            cursor: currentStep.canContinue ? "pointer" : "not-allowed",
            fontSize: "15px",
            fontWeight: "700",
          }}
        >
          {isLastStep ? "Continue — Enter Your Details" : "Continue"}
        </button>
      </div>
    </div>
  );
}
