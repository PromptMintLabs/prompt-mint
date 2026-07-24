# Third-Party Dependency License Policy

Prompt-Hash Stellar is a Soroban-based prompt licensing marketplace. The project
itself is licensed under **Apache-2.0**. Every third-party dependency — whether
packaged in the frontend (Node.js / Yarn) or compiled into on-chain contracts
(Rust / Cargo) — must be compatible with that license and with the commercial
nature of the platform.

This document defines the policy enforced by the CI license-compliance workflow
(`.github/workflows/license-compliance.yml`) and its supporting configuration
(`license-policy.json` for npm, `deny.toml` for Cargo).

---

## Why License Compliance Matters for a Blockchain Marketplace

| Risk | Impact |
|---|---|
| **Copyleft contamination** | A GPL-licensed dependency can force the entire project to be redistributed under GPL, conflicting with the Apache-2.0 license and undermining the ability to run the marketplace commercially. |
| **SSPL / BSL reach** | Licenses like SSPL (Server Side Public License) or BSL (Business Source License) require that the hosting service release *all* management and infrastructure code — an unreasonable obligation for a deployed marketplace. |
| **Non-commercial clauses** | CC-BY-NC (Creative Commons Non-Commercial) forbids commercial use. A marketplace that earns transaction fees from XLM payments is commercial by definition. |
| **Patent retaliation** | Some licenses include automatic patent-grant termination clauses that could expose contributors and operators to legal risk. |
| **Supply-chain hygiene** | Auditable dependency licenses are a prerequisite for security reviews, exchange listing evaluations, and enterprise customer due diligence. |

---

## License Categories

### Allowed Licenses

These licenses are permissive, Apache-2.0-compatible, and carry no copyleft,
patent-retaliation, or commercial-use restrictions.

| License | Rationale |
|---|---|
| **MIT** | Short, permissive, highly compatible. The most common OSS license in the JS and Rust ecosystems. |
| **Apache-2.0** | The project's own license. Provides explicit patent grant and is widely used in enterprise contexts. |
| **BSD-2-Clause** | Minimal two-clause BSD; permissive with no endorsement clause. |
| **BSD-3-Clause** | Three-clause BSD; adds a no-endorsement restriction. Compatible with Apache-2.0. |
| **ISC** | Functionally equivalent to MIT. Common in the npm ecosystem. |
| **CC0-1.0** | Public-domain dedication. No restrictions whatsoever. |
| **Unlicense** | Public-domain equivalent. Unrestricted use. |
| **0BSD** | Zero-clause BSD; public-domain-like. |
| **Python-2.0** | Permissive, GPL-compatible from the Python Software Foundation. Occasionally appears in build tooling. |

### Denied Licenses

These licenses are **blocked in CI** unless a formal exception is registered.
Any package carrying one of these licenses causes the `license-compliance`
workflow to fail.

| License | Risk |
|---|---|
| **GPL-2.0 / GPL-3.0** | Strong copyleft. Requires that derivative works be distributed under GPL. Incompatible with Apache-2.0 for combined works. |
| **AGPL-3.0** | Copyleft extended to network use (the "SaaS loophole" closure). Operating Prompt-Hash as a service could trigger source-release obligations. |
| **LGPL-2.1 / LGPL-3.0** | Weak copyleft for libraries. LGPL-2.1 is not Apache-2.0-compatible for static linking; LGPL-3.0 adds patent and DRM provisions that create uncertainty for WASM-compiled contracts. |
| **BUSL-1.1** | Business Source License. Time-bombed proprietary license that converts to a permissive license after a set period. Unsuitable for a production service that must operate indefinitely. |
| **SSPL-1.0** | Server Side Public License. Requires release of *all* service-management software if the service is offered to third parties. Unacceptable scope. |
| **Elastic-2.0** | Elastic License. Restricts use of the software as a managed service. A marketplace is inherently a managed service. |
| **CC-BY-NC-4.0** | Creative Commons Non-Commercial. Forbids commercial use. Prompt-Hash charges fees; it is commercial by any definition. |

### Review-Required Licenses

These licenses are not automatically denied but **require human review** before
they can be approved. Packages with review-required licenses cause the CI
workflow to fail until an exception is added or the license is reclassified.

| License | Why Review Is Needed |
|---|---|
| **MPL-2.0** | Mozilla Public License — file-level copyleft. Generally permissive at the project level but requires file-by-file analysis to confirm no MPL-licensed code is being modified and redistributed in WASM blobs. |
| **BSL-1.0** | Boost Software License — permissive but has a unique warranty disclaimer and requires that the original copyright and license be reproduced in any distribution. Usually fine but requires confirmation of distribution mechanism. |
| **CC-BY-4.0** | Creative Commons Attribution. Permissive but requires attribution. For a marketplace that displays multiple prompt authors, attribution stacking must be reviewed. |
| **CC-BY-SA-4.0** | Creative Commons Share-Alike. Copyleft for creative works (not code). If prompts or metadata are licensed this way, downstream modifications must be shared under the same license — a constraint the marketplace model must accommodate. |
| **EUPL-1.2** | European Union Public License. Copyleft with a compatibility list that includes GPL-2.0. Requires careful analysis of the compatibility matrix, especially for non-EU jurisdictions. |
| **OSL-3.0** | Open Software License. Copyleft with a patent-retaliation clause. Similar to AGPL in its network-use provisions but with a different legal lineage. Rare but should not be accidentally accepted. |

---

## Exception Process

### When to Request an Exception

An exception is required when:

- A **denied** license must be tolerated (e.g., a CLI tool used only at build
  time whose GPL license does not propagate into the shipped artifact).
- A **review-required** license has passed human review and is deemed acceptable
  for the specified scope.

### Who Reviews

Exceptions are reviewed by the project maintainers (`@Obiajulu-gif`, `@Birdmannn`,
`@OWK50GA`). Legal-significant exceptions (GPL-family, AGPL) require at least
two maintainer approvals.

### Exception Format

Each entry in `license-policy.json` → `.exceptions[]` must contain:

| Field | Type | Description |
|---|---|---|
| `package` | `string` | Exact package identifier (`name@version`). Use `*` for the version to match all versions of that name. |
| `license` | `string` | The SPDX license identifier being excepted. |
| `owner` | `string` | GitHub handle of the person who approved the exception. |
| `rationale` | `string` | Why the exception is justified. Include the analysis of scope (e.g., "only used as a dev tool during `vite build`"). |
| `scope` | `"cli-tool" \| "build-time" \| "runtime"` | When the dependency is consumed. |
| `expiry` | `"YYYY-MM-DD"` | Date the exception must be re-reviewed. Use `"permanent"` only for licenses that are unequivocally safe in their consumption scope. |

Example exception entry:

```json
{
  "package": "hypothetical-gpl-tool@1.0.1",
  "license": "GPL-3.0",
  "owner": "birdmannn",
  "rationale": "Used as a standalone CLI during `yarn build`. Does not link into any shipped artifact. No GPL code reaches the browser or the contract WASM.",
  "scope": "cli-tool",
  "expiry": "2027-01-01"
}
```

### How to Add or Update an Exception

1. Open `license-policy.json` and append or modify the `.exceptions[]` array.
2. In the same PR, include a brief justification comment in the PR description
   linking to any relevant package documentation or license analysis.
3. The `license-compliance` workflow will re-run on the PR and validate that the
   exception resolves the violation.
4. After merge, the exception is active.

Cargo-deny exceptions follow the same logic but are stored in `deny.toml` under
`[[licenses.exceptions]]`. See the placeholder in that file for syntax.

---

## CI Workflow

### Triggers

The workflow runs on:

- Pull requests targeting `main` that modify `package.json`, `yarn.lock`,
  `Cargo.toml`, `Cargo.lock`, `license-policy.json`, `deny.toml`, or the
  workflow file itself.
- Pushes to `main` that touch the same paths.

### Jobs

| Job | Tool | Coverage |
|---|---|---|
| **npm-license-check** | Custom Node.js scanner (`scripts/license-audit.mjs`) | All `node_modules` packages: direct, transitive, and nested (production + dev). Reads `license-policy.json`. |
| **cargo-license-check** | `cargo-deny` with `deny.toml` | All Rust workspace crates and their transitive dependencies. Includes WASM targets (`wasm32v1-none`). |

### Failure Output Format

When a violation is detected, the job outputs one line per offending package:

```
  ERROR  some-crate@1.2.3  license=GPL-3.0  path=root-dep → intermediate → some-crate
```

- **Package name and version**: The exact dependency that violates the policy.
- **License**: The SPDX identifier found in the package metadata.
- **Dependency path**: The parent-to-child chain showing how the offending
  package was pulled into the project. The first entry is the direct dependency
  that introduced it; the last entry is the violating package itself.

### Interpreting Failures

1. Read the license field — is it a denied license (GPL family etc.) or a
   review-required license?
2. Read the dependency path — which direct dependency pulled this in? Can that
   dependency be swapped for an alternative with a compatible license?
3. If the package is unavoidable and the usage is safe-scoped (e.g., a
   build-time-only GPL tool that does not link into shipped artifacts), file
   an exception.
4. If the license is unknown or the package has no license, treat it as a
   potential supply-chain risk and investigate the package maintainer's
   licensing intent.

### Coverage Summary

| Ecosystem | Tool | Production | Development | Transitive |
|---|---|---|---|---|
| npm (Node.js) | `scripts/license-audit.mjs` | Yes | Yes | Yes (via nested `node_modules` traversal) |
| Cargo (Rust) | `cargo-deny` | Yes | Yes (build-deps) | Yes (full dependency graph) |

---

## References

- [SPDX License List](https://spdx.org/licenses/) — canonical license identifiers.
- [Apache-2.0 Compatibility](https://www.apache.org/legal/resolved.html#category-a) — Apache Foundation's compatibility guidance.
- [cargo-deny License Check](https://embarkstudios.github.io/cargo-deny/checks/licenses/cfg.html) — Rust-side configuration reference.
- [GNU License List](https://www.gnu.org/licenses/license-list.html) — FSF commentary on license compatibility.
