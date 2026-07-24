# Performance Budgets

PromptHash Stellar enforces per-route performance budgets in CI to catch regressions before they reach production. Budgets cover JavaScript payload size, image weight, and Core Web Vitals thresholds.

## Route Budgets

| Route            | JS (kB) | Images (kB) | LCP (ms) | INP (ms) | CLS  | Transition (ms) |
| ---------------- | ------- | ----------- | -------- | -------- | ---- | --------------- |
| browse           | 150     | 300         | 2500     | 200      | 0.1  | 300             |
| listing-detail   | 120     | 400         | 2000     | 150      | 0.1  | 250             |
| checkout         | 100     | 200         | 1800     | 150      | 0.05 | 300             |
| sell             | 150     | 300         | 2500     | 200      | 0.1  | 300             |
| library           | 120     | 200         | 2200     | 180      | 0.1  | 250             |

- **JS budgets** are measured as minified + gzipped kilobytes. Vite code-splits each lazy route into separate chunks.
- **Image budgets** are total kilobytes of image assets referenced on a route.
- **LCP** (Largest Contentful Paint) and **INP** (Interaction to Next Paint) are measured in milliseconds.
- **CLS** (Cumulative Layout Shift) is a unitless score (0 = perfect).
- **Transition** is the client-side navigation latency between routes.

### Rationale

Browse and sell pages accept higher budgets because they render dynamic grid layouts with preview cards, image thumbnails, and interactive controls. Checkout and library routes are form-heavy and should remain lean. Listing-detail carries a moderate image budget to support prompt previews but keeps JS light.

## Device Profiles

CI evaluates budgets against three device profiles. Each profile applies a multiplier to the base desktop budget:

| Profile               | Factor | Description                                         |
| --------------------- | ------ | --------------------------------------------------- |
| `desktop`             | 1.0    | Baseline budget (no adjustment)                     |
| `mobile`              | 0.5    | 50 % stricter — 4G throttled, 4× CPU slowdown       |
| `reduced-capability`  | 0.3    | 70 % stricter — 2 GB RAM, mid-range CPU             |

### Mobile Network Profile

The mobile profile assumes a throttled 4G connection (4 Mbps down, 4× CPU slowdown via Chrome DevTools emulation). This approximates a mid-tier Android device on a realistic cellular network.

### Reduced-Device-Capability Profile

The reduced-capability profile targets devices with 2 GB RAM and a mid-range CPU. Budgets are tightened to 30 % of the desktop baseline to ensure acceptable experience on constrained hardware.

## CI Evaluation

The `performance-budgets` workflow triggers on every pull request to `main` that touches `src/**` or `package.json`.

1. **Build** — `yarn build` produces a production Vite bundle in `dist/`.
2. **Analyze** — The evaluation script (`scripts/check-budgets.ts`) parses the build output, maps JavaScript chunks to routes, computes gzipped sizes, and calls `checkBudgets()` from `src/test/performance/budgets.ts`.
3. **Report** — The report is written to `budget-report.json` and uploaded as a workflow artifact.

### Violation Output

When a budget is exceeded, the CI step annotates the pull request with:

- The route name that failed
- The specific metric that exceeded its budget (e.g., `js: actual 162 kB exceeds budget 75 kB`)
- The three largest contributors (file or dependency) by gzipped size

## Updating Budgets

Budgets are defined in `src/test/performance/budgets.ts` in the `ROUTE_BUDGETS` constant.

To update a budget:

1. Open `src/test/performance/budgets.ts`.
2. Modify the value for the relevant route and metric.
3. Open a pull request. The CI workflow will validate the new values against the current build.
4. Update this document to keep the table in sync.

If a budget was violated because a route legitimately grew, raise the budget conservatively and add a comment in the route's page component explaining what caused the increase.
