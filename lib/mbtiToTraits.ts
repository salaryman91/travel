import type { MBTI, Trait } from "./types";

export function mbtiToTraits(mbti: MBTI): Record<Trait, number> {
  const [a, b, c, d] = mbti.split("") as [string, string, string, string];
  const t: Record<Trait, number> = {
    social: 0.5, novelty: 0.5, structure: 0.5, flexibility: 0.5, sensory: 0.5, culture: 0.5,
  };
  if (a === "E") t.social += 0.25; else t.social -= 0.15;
  if (b === "N") { t.novelty += 0.25; t.culture += 0.1; } else { t.sensory += 0.2; t.structure += 0.05; }
  if (c === "F") { t.culture += 0.2; t.social += 0.05; } else { t.structure += 0.1; }
  if (d === "J") { t.structure += 0.25; t.flexibility -= 0.1; } else { t.flexibility += 0.25; }
  (Object.keys(t) as Trait[]).forEach((k) => (t[k] = Math.max(0, Math.min(1, t[k]))));
  return t;
}