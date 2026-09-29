// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural contract for the onboarding email copy decks and the translator
 * contribution guide. These are prose artifacts, so nothing in the compiler
 * catches a dropped field, an undeclared merge token, a dead cross-link, or a
 * marketing claim the product cannot back. This test is the only automated
 * guard they have.
 */

const root = path.resolve(__dirname, "../../..");

const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

const DECKS = [
  {
    name: "buyer",
    prefix: "BUY",
    file: "docs/buyer-onboarding-email-copy-deck.md",
    markdown: read("docs/buyer-onboarding-email-copy-deck.md"),
  },
  {
    name: "creator",
    prefix: "CRE",
    file: "docs/creator-onboarding-email-copy-deck.md",
    markdown: read("docs/creator-onboarding-email-copy-deck.md"),
  },
  {
    name: "translator",
    prefix: "GUIDE",
    file: "docs/translator-contribution-guide.md",
    markdown: read("docs/translator-contribution-guide.md"),
  },
] as const;

const buyerDeck = DECKS[0].markdown;
const creatorDeck = DECKS[1].markdown;
const translatorGuide = DECKS[2].markdown;

const DECK_SECTIONS = [
  "## Scope",
  "## Voice and Tone",
  "## Sending Rules",
  "## Compliance Rules",
  "## Token Reference",
  "## Localization",
  "## Related",
];

const GUIDE_SECTIONS = [
  "## What You Can Translate",
  "## Before You Start",
  "## Repository Layout",
  "## Translating the UI",
  "## Translating Email Copy Decks",
  "## Translating Documentation",
  "## Style Rules",
  "## Plurals, Numbers, and Currency",
  "## Testing Your Translation",
  "## Submitting a Translation",
  "## Review Process",
  "## Adding a New Language",
  "## Glossary",
  "## Related",
];

const REQUIRED_EMAIL_FIELDS = [
  "- **Trigger:**",
  "- **Segment:**",
  "- **Goal:**",
  "- **Send window:**",
  "- **Subject:**",
  "- **Preheader:**",
  "- **Body:**",
  "- **Primary CTA:**",
  "- **Footer / compliance:**",
  "- **Success metric:**",
];

const PROHIBITED_CLAIMS = [
  /guaranteed/i,
  /risk[- ]free/i,
  /act now/i,
  /limited time/i,
  /earn passive/i,
  /price (?:will )?(?:rise|increase|go up)/i,
  /don'?t miss out/i,
];

type Email = { id: string; title: string; body: string };

/** Strips fenced code blocks and inline code so scans only see prose. */
const stripCode = (markdown: string) =>
  markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");

const stripTokens = (value: string) => value.replace(/\{\{[a-zA-Z]+\}\}/g, "").trim();

/** Mirrors the GitHub heading slugger: drop punctuation, spaces become hyphens. */
const slug = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/ /g, "-");

function parseEmails(markdown: string, prefix: string): Email[] {
  const heading = new RegExp(`^## (${prefix}-\\d{2}) — (.+)$`, "gm");
  const matches = [...markdown.matchAll(heading)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    return { id: match[1], title: match[2].trim(), body: markdown.slice(start, end) };
  });
}

/** Extracts one `- **Field:** value` bullet, stopping at the next bullet or code fence. */
const field = (email: Email, name: string) => {
  const pattern = new RegExp("- \\*\\*" + name + ":\\*\\* ([\\s\\S]*?)(?=\\n- \\*\\*|$)");
  return email.body.match(pattern)?.[1] ?? "";
};

/** The plain-text body itself, without the surrounding field label and fence. */
const bodyText = (email: Email) => email.body.match(/```text\n([\s\S]*?)```/)?.[1] ?? "";

const copy = (email: Email) =>
  [field(email, "Subject"), field(email, "Preheader"), bodyText(email)].join("\n");

describe("onboarding email copy decks", () => {
  it.each(DECKS)("$name artifact exists on disk", (deck) => {
    expect(existsSync(path.join(root, deck.file))).toBe(true);
    expect(deck.markdown.startsWith("# ")).toBe(true);
  });

  it.each(DECKS.slice(0, 2))("$name deck has the required sections", (deck) => {
    for (const section of DECK_SECTIONS) {
      expect(deck.markdown).toContain(section);
    }
  });

  it("translator guide has the required sections", () => {
    for (const section of GUIDE_SECTIONS) {
      expect(translatorGuide).toContain(section);
    }
  });

  it.each(DECKS.slice(0, 2))("$name deck numbers its emails with unique contiguous ids", (deck) => {
    const emails = parseEmails(deck.markdown, deck.prefix);
    expect(emails.length).toBeGreaterThanOrEqual(6);

    const ids = emails.map((email) => email.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Contiguous from 01, so deleting an email leaves a visible gap in review.
    ids.forEach((id, index) => expect(id).toBe(`${deck.prefix}-${String(index + 1).padStart(2, "0")}`));
  });

  it.each(DECKS.slice(0, 2))("$name deck specifies every field of every email", (deck) => {
    for (const email of parseEmails(deck.markdown, deck.prefix)) {
      for (const required of REQUIRED_EMAIL_FIELDS) {
        expect(email.body, `${email.id} is missing ${required}`).toContain(required);
      }
    }
  });

  it.each(DECKS.slice(0, 2))("$name deck ships a plain-text body per email", (deck) => {
    for (const email of parseEmails(deck.markdown, deck.prefix)) {
      const body = bodyText(email);
      expect(body, `${email.id} has no plain-text body`).toBeTruthy();
      expect(body.length).toBeGreaterThan(200);
    }
  });

  it.each(DECKS.slice(0, 2))("$name deck declares every merge token its copy uses", (deck) => {
    // Scoped to the copy and its reference table. The Localization section talks
    // *about* tokens and mentions `{{token}}` as a shape, not as a real one.
    const table = deck.markdown.slice(
      deck.markdown.indexOf("## Token Reference"),
      deck.markdown.indexOf("## Localization"),
    );
    const copyRegion = deck.markdown.slice(0, deck.markdown.indexOf("## Localization"));
    const declared = new Set(
      [...table.matchAll(/`(\{\{[a-zA-Z]+\}\})`/g)].map((match) => match[1]),
    );
    const used = new Set(
      [...copyRegion.matchAll(/\{\{([a-zA-Z]+)\}\}/g)].map((match) => `{{${match[1]}}}`),
    );

    expect(used.size).toBeGreaterThan(5);
    for (const token of used) {
      expect(declared, `${deck.file} uses undeclared token ${token}`).toContain(token);
    }
    // An unused row means the table drifted from the copy.
    for (const token of declared) {
      expect(used, `${deck.file} documents unused token ${token}`).toContain(token);
    }
  });

  it.each(DECKS.slice(0, 2))("$name deck keeps subject and preheader within inbox limits", (deck) => {
    for (const email of parseEmails(deck.markdown, deck.prefix)) {
      expect(stripTokens(field(email, "Subject")).length, `${email.id} subject`).toBeLessThanOrEqual(60);
      expect(
        stripTokens(field(email, "Preheader")).length,
        `${email.id} preheader`,
      ).toBeLessThanOrEqual(100);
    }
  });

  it.each(DECKS.slice(0, 2))("$name deck makes unsubscribe a code guarantee", (deck) => {
    expect(deck.markdown).toContain("### Shared footer");
    expect(deck.markdown).toContain("{{unsubscribeUrl}}");
    expect(deck.markdown).toContain("{{supportEmail}}");
    expect(deck.markdown).toContain("List-Unsubscribe");
    expect(deck.markdown).toContain("notificationPreferences.emailNotifications");
    expect(deck.markdown).toContain("emailNotifications.ts");
    expect(deck.markdown).toContain("unsubscribeToken.ts");
  });

  it.each(DECKS.slice(0, 2))("$name deck never claims something the product cannot back", (deck) => {
    for (const email of parseEmails(deck.markdown, deck.prefix)) {
      for (const claim of PROHIBITED_CLAIMS) {
        expect(claim.test(copy(email)), `${email.id} contains a prohibited claim`).toBe(false);
      }
    }
  });

  it.each(DECKS.slice(0, 2))("$name deck links the translator guide and platform docs", (deck) => {
    expect(deck.markdown).toContain("translator-contribution-guide.md");
    expect(deck.markdown).toContain("product-journeys.md");
    expect(deck.markdown).toContain("legal/data-retention-policy.md");
  });

  it("buyer deck warns that no seed phrase is ever requested", () => {
    const unlockHelp = parseEmails(buyerDeck, "BUY").find((email) => email.id === "BUY-06");
    expect(unlockHelp).toBeTruthy();
    expect(unlockHelp?.body).toContain("seed phrase");
    expect(unlockHelp?.body).toContain("never ask for it");
  });

  it("creator deck sends the recorded delist reason and the appeal path", () => {
    const reactivation = parseEmails(creatorDeck, "CRE").find((email) => email.id === "CRE-07");
    expect(reactivation).toBeTruthy();
    expect(reactivation?.body).toContain("{{delistReason}}");
    expect(reactivation?.body).toContain("{{delistedCount}}");
    expect(stripCode(reactivation?.body ?? "")).toContain("appeal");
  });

  it("fee-bearing emails show the split the contract computes", () => {
    const firstSale = parseEmails(creatorDeck, "CRE").find((email) => email.id === "CRE-03");
    expect(firstSale?.body).toContain("{{priceXlm}}");
    expect(firstSale?.body).toContain("{{netPayoutXlm}}");
    expect(firstSale?.body).toContain("{{platformFeeXlm}}");

    const receipt = parseEmails(buyerDeck, "BUY").find((email) => email.id === "BUY-05");
    expect(receipt?.body).toContain("{{priceXlm}}");
    expect(receipt?.body).toContain("{{txHash}}");

    const statement = parseEmails(creatorDeck, "CRE").find((email) => email.id === "CRE-08");
    expect(statement?.body).toContain("{{netPayoutXlm}}");
    expect(statement?.body).toContain("{{txHashList}}");
  });

  it("each deck points at its counterpart rather than duplicating it", () => {
    expect(buyerDeck).toContain("creator-onboarding-email-copy-deck.md");
    expect(creatorDeck).toContain("buyer-onboarding-email-copy-deck.md");
  });
});

describe("copy deck navigation and cross-links", () => {
  it.each(DECKS)("$name artifact table of contents covers every section", (deck) => {
    const toc = deck.markdown.slice(
      deck.markdown.indexOf("## Table of Contents"),
      deck.markdown.indexOf(deck.prefix === "GUIDE" ? GUIDE_SECTIONS[0] : DECK_SECTIONS[0]),
    );
    const headings = [...stripCode(deck.markdown).matchAll(/^## (.+)$/gm)]
      .map((match) => match[1].trim())
      .filter((heading) => heading !== "Table of Contents");

    expect(headings.length).toBeGreaterThanOrEqual(6);
    for (const heading of headings) {
      expect(toc, `${deck.file} has no ToC entry for "## ${heading}"`).toContain(`#${slug(heading)}`);
    }
  });

  it.each(DECKS)("$name artifact has no dead relative links", (deck) => {
    const links = [
      ...stripCode(deck.markdown).matchAll(/\]\((\.{1,2}\/[^)#]+)(?:#[^)]*)?\)/g),
    ].map((match) => match[1]);

    expect(links.length).toBeGreaterThan(5);
    const from = path.dirname(path.join(root, deck.file));
    for (const link of new Set(links)) {
      expect(existsSync(path.resolve(from, link)), `${deck.file} -> ${link}`).toBe(true);
    }
  });

  it("the new docs are discoverable from the existing doc index", () => {
    const journeys = read("docs/product-journeys.md");
    expect(journeys).toContain("buyer-onboarding-email-copy-deck.md");
    expect(journeys).toContain("creator-onboarding-email-copy-deck.md");

    const monorepoMap = read("docs/monorepo-map.md");
    expect(monorepoMap).toContain("translator-contribution-guide.md");
  });
});

describe("translator contribution guide", () => {
  it("matches the i18n implementation the repo actually ships", () => {
    const index = read("src/i18n/index.ts");
    for (const code of ["en", "es", "fr", "zh", "ja", "de", "yo"]) {
      expect(translatorGuide).toContain(code);
      expect(index).toContain(`code: '${code}'`);
    }
    for (const section of ["nav", "home", "prompt", "create", "errors", "language"]) {
      expect(translatorGuide).toContain(section);
    }
    for (const section of ["nav", "home", "prompt", "create", "errors", "language"]) {
      expect(JSON.parse(read(`src/i18n/locales/en.json`))).toHaveProperty(section);
    }
  });

  it("names the locale files and the setup the new-language steps require", () => {
    expect(translatorGuide).toContain("src/i18n/locales/en.json");
    expect(translatorGuide).toContain("src/i18n/index.ts");
    expect(translatorGuide).toContain("SUPPORTED_LANGUAGES");
    expect(translatorGuide).toContain("resources");
  });

  it("repeats the number-formatting rules from CONTRIBUTING.md", () => {
    expect(translatorGuide).toContain("formatXlmLocale");
    expect(translatorGuide).toContain("en-US");
    expect(translatorGuide).toContain("stroops");
    expect(translatorGuide).toContain("../CONTRIBUTING.md");
  });

  it("keys email translations by id, not by subject line", () => {
    expect(translatorGuide).toContain("BUY-01");
    expect(translatorGuide).toContain("CRE-07");
    expect(translatorGuide).toContain("emails");
  });

  it("flags the strings that need a second native-speaker reviewer", () => {
    for (const id of ["BUY-02", "BUY-05", "CRE-03", "CRE-07", "CRE-08"]) {
      expect(translatorGuide).toContain(id);
    }
  });

  it("lists the checks a translator runs before opening a pull request", () => {
    for (const command of ["yarn test:frontend", "yarn lint", "yarn typecheck"]) {
      expect(translatorGuide).toContain(command);
    }
  });
});
