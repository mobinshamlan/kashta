import { z } from "zod";
import { FACTORS } from "./types";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const factorSchema = z.enum(FACTORS as [string, ...string[]]) as z.ZodType<
  "temp" | "wind" | "rain" | "dust" | "clouds" | "moon"
>;

export const planPrefsSchema = z.object({
  experience: z.enum(["kashta", "stars"]),
  city: z.literal("riyadh"),
  date: z.union([z.literal("flexible"), dateString]),
  groupSize: z.number().int().min(1).max(40),
  maxDriveHours: z.number().min(0.5).max(6),
  tempPref: z.enum(["cool", "mild", "warm"]),
  windTolerance: z.enum(["low", "medium", "high"]),
  priorities: z.array(factorSchema).max(3).default([]),
});

export type PlanPrefsInput = z.infer<typeof planPrefsSchema>;

export const interpretRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(4, "too_short")
    .max(600, "too_long"),
  locale: z.enum(["ar", "en"]).default("ar"),
});

/**
 * What Llama must return when it reads a free-text description. Every field is optional:
 * Llama only fills what the user actually said. Unknown keys are dropped.
 */
export const interpretedPrefsSchema = z.object({
  redirect: z.string().trim().min(1).max(350).nullish(),
  experience: z.enum(["kashta", "stars"]).nullish(),
  groupSize: z.coerce.number().int().min(1).max(40).nullish(),
  tempPref: z.enum(["cool", "mild", "warm"]).nullish(),
  windTolerance: z.enum(["low", "medium", "high"]).nullish(),
  maxDriveHours: z.coerce.number().min(0.5).max(6).nullish(),
  date: z.union([z.literal("flexible"), dateString]).nullish(),
  priorities: z.array(factorSchema).max(3).nullish(),
  summary: z.string().max(300).nullish(),
  unclear: z.array(z.string().max(160)).max(5).nullish(),
});

export type InterpretedPrefs = z.infer<typeof interpretedPrefsSchema>;

export const explainRequestSchema = z.object({
  slug: z.string().min(1).max(80),
  date: dateString,
  prefs: planPrefsSchema,
  locale: z.enum(["ar", "en"]).default("ar"),
});

export const explanationSchema = z.object({
  summary: z.string().min(1).max(600),
  reasons: z.array(z.string().max(300)).max(5).default([]),
  cautions: z.array(z.string().max(300)).max(5).default([]),
  packing: z.array(z.string().max(160)).max(8).default([]),
  preparations: z.array(z.string().max(300)).max(5).default([]),
  alternative: z
    .object({ slug: z.string(), date: dateString, why: z.string().max(300) })
    .nullish(),
});

export type Explanation = z.infer<typeof explanationSchema>;
