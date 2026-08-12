import {
  DEFAULT_APS_TOLERANCE,
  DEFAULT_SUBJECT_PERCENTAGE_TOLERANCE,
  type StudentProfile,
} from "@/lib/profile";

/**
 * Tolerances only widen the "Almost Qualify" band. They can NEVER turn a failed
 * requirement into a met requirement — `met` is decided by the raw comparison.
 */
export type ToleranceSettings = {
  apsTolerance: number;
  subjectPercentageTolerance: number;
};

export function toleranceSettings(profile: StudentProfile | null): ToleranceSettings {
  return {
    apsTolerance: profile?.aps_tolerance ?? DEFAULT_APS_TOLERANCE,
    subjectPercentageTolerance:
      profile?.subject_percentage_tolerance ?? DEFAULT_SUBJECT_PERCENTAGE_TOLERANCE,
  };
}

export type RequirementOutcome = "met" | "almost" | "not_met";

function outcome(actual: number, required: number, tolerance: number): RequirementOutcome {
  if (actual >= required) return "met";
  if (actual >= required - Math.max(0, tolerance)) return "almost";
  return "not_met";
}

/** APS requirements are evaluated separately from subject percentage requirements. */
export function evaluateApsRequirement(
  actualAps: number,
  requiredAps: number,
  settings: ToleranceSettings,
): RequirementOutcome {
  return outcome(actualAps, requiredAps, settings.apsTolerance);
}

export function evaluateSubjectPercentageRequirement(
  actualPercentage: number,
  requiredPercentage: number,
  settings: ToleranceSettings,
): RequirementOutcome {
  return outcome(actualPercentage, requiredPercentage, settings.subjectPercentageTolerance);
}
