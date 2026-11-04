"use client";

import { Check, Flag } from "lucide-react";
import type { CSSProperties } from "react";

export type RailStep = {
  n: 1 | 2 | 3 | 4;
  label: string;
  /** What was chosen, shown under a completed step on wider screens. */
  value?: string;
  /** Whether the step can be opened from here. */
  reachable: boolean;
};

/**
 * One horizontal rail for the planner: activity → night → place → plan. The line between the
 * steps fills as the plan advances; completed steps stay clickable so going back is one tap.
 * Sticky inside the planner only, so it never follows the visitor into unrelated sections.
 */
export function PlanRail({
  steps,
  step,
  onStep,
  label,
  ready = false,
  showValues = true,
  variant = "sand",
  navigate = false,
}: {
  steps: RailStep[];
  step: 1 | 2 | 3 | 4;
  onStep: (n: 1 | 2 | 3 | 4) => void;
  label: string;
  /** Every choice is made and the plan is the next thing: mark the last step as "next", not "current". */
  ready?: boolean;
  showValues?: boolean;
  /** "night": the homepage's dark, glassy rail over the scene. */
  variant?: "sand" | "night";
  /** Section navigation: every reachable step (the current one too) scrolls to its section. */
  navigate?: boolean;
}) {
  const progress = ready ? 1 : (step - 1) / 3;
  return (
    <nav className={`plan-rail ${variant === "night" ? "plan-rail--night" : ""}`} aria-label={label}>
      <ol style={{ "--rail-progress": progress } as CSSProperties}>
        {steps.map((s) => {
          const done = ready ? s.n < 4 : s.n < step;
          const current = !ready && s.n === step;
          const state = done ? "done" : current ? "current" : ready && s.n === 4 ? "next" : "todo";
          const clickable = s.reachable && (navigate || !current);
          return (
            <li key={s.n} data-state={state} aria-current={current ? "step" : undefined}>
              <button
                type="button"
                className="rail-node"
                disabled={!clickable}
                onClick={() => onStep(s.n)}
                aria-label={`${s.n}. ${s.label}${done && s.value ? `: ${s.value}` : ""}`}
              >
                <span className="rail-dot num" aria-hidden>
                  {done ? <Check size={15} strokeWidth={2.5} /> : s.n === 4 ? <Flag size={14} /> : s.n}
                </span>
                <span className="rail-label">{s.label}</span>
                {showValues && done && s.value && <span className="rail-value">{s.value}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
