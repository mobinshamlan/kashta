"use client";

import { Flame, Sparkles } from "lucide-react";
import { useId } from "react";
import type { Experience } from "@/lib/types";
import { useI18n } from "./locale-provider";

/** Kashta or stargazing: one choice, two real radio inputs. */
export function ModeSwitch({
  value,
  onChange,
  tone = "night",
  legend,
  className = "",
}: {
  value: Experience;
  onChange: (next: Experience) => void;
  tone?: "night" | "sand";
  legend?: string;
  className?: string;
}) {
  const { dict } = useI18n();
  const name = useId();
  return (
    <fieldset className={className}>
      <legend className={legend ? "small mb-3 font-medium" : "sr-only"}>{legend ?? dict.plan.experienceLabel}</legend>
      <div className={`mode-switch ${tone === "sand" ? "on-sand" : ""}`}>
        {(["kashta", "stars"] as const).map((x) => (
          <label key={x} className="mode-option" data-opt={x}>
            <input type="radio" name={name} value={x} checked={value === x} onChange={() => onChange(x)} />
            {x === "kashta" ? <Flame aria-hidden size={18} /> : <Sparkles aria-hidden size={18} />}
            {dict.experience[x]}
          </label>
        ))}
      </div>
      <p className={`small mt-2 ${tone === "sand" ? "text-ink-2" : "muted"}`}>
        {value === "kashta" ? dict.experience.kashtaDesc : dict.experience.starsDesc}
      </p>
    </fieldset>
  );
}
