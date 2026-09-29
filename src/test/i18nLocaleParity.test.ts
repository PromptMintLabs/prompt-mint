/**
 * i18n locale key-parity tests (#713, #714, #715, #716).
 *
 * Every locale registered in SUPPORTED_LANGUAGES must carry exactly the same
 * leaf keys as en.json, with the same interpolation placeholders, so no page
 * silently falls back to English key by key.
 */
import { describe, it, expect } from "vitest";
import i18n, { SUPPORTED_LANGUAGES } from "../i18n";

type Tree = { [key: string]: string | Tree };

const leaves = (tree: Tree, prefix = ""): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string"
      ? { ...acc, [path]: value }
      : { ...acc, ...leaves(value, path) };
  }, {});

const placeholders = (text: string) => (text.match(/{{\s*\w+\s*}}/g) ?? []).sort();

const bundle = (code: string) => leaves(i18n.getResourceBundle(code, "translation") as Tree);
const en = bundle("en");

describe("locale key parity with en.json", () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    it(`locale '${code}' has the same keys and placeholders as en`, () => {
      const locale = bundle(code);
      expect(Object.keys(locale).sort()).toEqual(Object.keys(en).sort());
      for (const [key, value] of Object.entries(en)) {
        expect(locale[key].trim(), `${code}: '${key}' is empty`).not.toBe("");
        expect(placeholders(locale[key]), `${code}: '${key}' placeholders`).toEqual(
          placeholders(value)
        );
      }
    });
  }

  it("ships German and Yoruba", () => {
    i18n.changeLanguage("de");
    expect(i18n.t("errors.validation.required")).toBe("Dieses Feld ist erforderlich.");
    i18n.changeLanguage("yo");
    expect(i18n.t("errors.validation.required")).toBe("Àyè yìí jẹ́ dandan.");
    i18n.changeLanguage("en");
  });
});
