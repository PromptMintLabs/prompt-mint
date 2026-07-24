export interface BudgetLimit {
  js: number;
  images: number;
  lcp: number;
  inp: number;
  cls: number;
  transition: number;
}

export const ROUTE_BUDGETS = {
  browse: { js: 150, images: 300, lcp: 2500, inp: 200, cls: 0.1, transition: 300 },
  "listing-detail": { js: 120, images: 400, lcp: 2000, inp: 150, cls: 0.1, transition: 250 },
  checkout: { js: 100, images: 200, lcp: 1800, inp: 150, cls: 0.05, transition: 300 },
  sell: { js: 150, images: 300, lcp: 2500, inp: 200, cls: 0.1, transition: 300 },
  library: { js: 120, images: 200, lcp: 2200, inp: 180, cls: 0.1, transition: 250 },
} as const satisfies Record<string, BudgetLimit>;

export type Profile = "desktop" | "mobile" | "reduced-capability";

const PROFILE_FACTORS: Record<Profile, number> = {
  desktop: 1,
  mobile: 0.5,
  "reduced-capability": 0.3,
};

export function getProfileBudget(profile: Profile): Record<string, BudgetLimit> {
  const factor = PROFILE_FACTORS[profile];
  return Object.fromEntries(
    Object.entries(ROUTE_BUDGETS).map(([route, limits]) => [
      route,
      {
        js: Math.round(limits.js * factor * 100) / 100,
        images: Math.round(limits.images * factor * 100) / 100,
        lcp: Math.round(limits.lcp * factor * 100) / 100,
        inp: Math.round(limits.inp * factor * 100) / 100,
        cls: Math.round(limits.cls * factor * 10000) / 10000,
        transition: Math.round(limits.transition * factor * 100) / 100,
      },
    ]),
  );
}

export interface ContributorEntry {
  name: string;
  size: number;
}

export interface BudgetViolation {
  metric: keyof BudgetLimit;
  budget: number;
  actual: number;
}

export interface RouteBudgetReport {
  route: string;
  profile: Profile;
  violations: BudgetViolation[];
  topContributors: ContributorEntry[];
  pass: boolean;
}

export type BudgetReport = RouteBudgetReport[];

export interface BuildRouteData {
  route: string;
  jsSize?: number;
  imageSize?: number;
  lcp?: number;
  inp?: number;
  cls?: number;
  transition?: number;
  dependencies: ContributorEntry[];
}

export function checkBudgets(
  buildData: BuildRouteData[],
  profile: Profile = "desktop",
): BudgetReport {
  const budgets = getProfileBudget(profile);

  return buildData.map((data) => {
    const budget = budgets[data.route];
    if (!budget) {
      return {
        route: data.route,
        profile,
        violations: [],
        topContributors: data.dependencies.slice(0, 3),
        pass: true,
      };
    }

    const violations: BudgetViolation[] = [];

    if (data.jsSize !== undefined && data.jsSize > budget.js) {
      violations.push({ metric: "js", budget: budget.js, actual: data.jsSize });
    }
    if (data.imageSize !== undefined && data.imageSize > budget.images) {
      violations.push({ metric: "images", budget: budget.images, actual: data.imageSize });
    }
    if (data.lcp !== undefined && data.lcp > budget.lcp) {
      violations.push({ metric: "lcp", budget: budget.lcp, actual: data.lcp });
    }
    if (data.inp !== undefined && data.inp > budget.inp) {
      violations.push({ metric: "inp", budget: budget.inp, actual: data.inp });
    }
    if (data.cls !== undefined && data.cls > budget.cls) {
      violations.push({ metric: "cls", budget: budget.cls, actual: data.cls });
    }
    if (data.transition !== undefined && data.transition > budget.transition) {
      violations.push({
        metric: "transition",
        budget: budget.transition,
        actual: data.transition,
      });
    }

    return {
      route: data.route,
      profile,
      violations,
      topContributors: data.dependencies.slice(0, 3),
      pass: violations.length === 0,
    };
  });
}
