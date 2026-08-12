/**
 * Thin view layer over the eligibility service: adds the province of each
 * course's institution (the engine works with ids only) and derives filter
 * options from whatever the engine returned. No matching logic lives here.
 */
import { evaluateMyEligibility, type EligibilityReport } from "@/lib/eligibility.service";
import { fetchProvinces, fetchUniversities } from "@/lib/catalogue";
import type { CourseEligibility } from "@/lib/eligibility";

export type CourseEligibilityView = CourseEligibility & { provinceName: string | null };

export type EligibilityView = {
  report: EligibilityReport;
  courses: CourseEligibilityView[];
  hasResults: boolean;
};

export async function loadEligibilityView(userId: string): Promise<EligibilityView> {
  const [report, provinces, universities] = await Promise.all([
    evaluateMyEligibility(userId),
    fetchProvinces(),
    fetchUniversities(),
  ]);

  const provinceById = new Map(provinces.map((p) => [p.id, p.name]));
  const provinceByUniversity = new Map(
    universities.map((u) => [u.id, provinceById.get(u.province_id) ?? null]),
  );

  return {
    report,
    hasResults: report.hasResults,
    courses: report.courses.map((course) => ({
      ...course,
      provinceName: course.universityId
        ? (provinceByUniversity.get(course.universityId) ?? null)
        : null,
    })),
  };
}

export type FilterOptions = {
  universities: string[];
  faculties: string[];
  provinces: string[];
  qualifications: string[];
};

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function filterOptions(courses: CourseEligibilityView[]): FilterOptions {
  return {
    universities: unique(courses.map((c) => c.universityName)),
    faculties: unique(courses.map((c) => c.facultyName)),
    provinces: unique(courses.map((c) => c.provinceName)),
    qualifications: unique(courses.map((c) => c.qualificationName)),
  };
}

export type EligibilityFilters = {
  university: string;
  faculty: string;
  province: string;
  qualification: string;
};

export const EMPTY_FILTERS: EligibilityFilters = {
  university: "",
  faculty: "",
  province: "",
  qualification: "",
};

/** Filters operate on the already-evaluated results — nothing is re-matched. */
export function applyFilters(
  courses: CourseEligibilityView[],
  filters: EligibilityFilters,
): CourseEligibilityView[] {
  return courses.filter(
    (c) =>
      (!filters.university || c.universityName === filters.university) &&
      (!filters.faculty || c.facultyName === filters.faculty) &&
      (!filters.province || c.provinceName === filters.province) &&
      (!filters.qualification || c.qualificationName === filters.qualification),
  );
}