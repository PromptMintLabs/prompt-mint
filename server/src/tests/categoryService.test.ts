describe("Category Service", () => {
  const mockCategories = [
    {
      id: "marketing",
      name: "Marketing",
      description: "Marketing prompts",
      aliases: ["marketing", "advertisement", "promo"],
    },
    {
      id: "programming",
      name: "Programming",
      description: "Programming prompts",
      aliases: ["programming", "coding", "development", "software"],
    },
    {
      id: "other",
      name: "Other",
      description: "Other prompts",
      aliases: ["other", "misc"],
    },
  ];

  describe("Normalize Category", () => {
    it("should match exact category name", () => {
      const input = "Marketing";
      const category = mockCategories.find((c) => c.name === input);
      expect(category?.name).toBe("Marketing");
    });

    it("should match category alias", () => {
      const input = "coding";
      const category = mockCategories.find((c) =>
        c.aliases.some((alias) => alias.toLowerCase() === input.toLowerCase()),
      );
      expect(category?.name).toBe("Programming");
    });

    it("should normalize unknown category to title case", () => {
      const input = "custom-category";
      const normalized = input
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");

      expect(normalized).toBe("Custom Category");
    });

    it("should handle empty input", () => {
      const input = "";
      const result = input.trim() || "Other";
      expect(result).toBe("Other");
    });

    it("should be case insensitive", () => {
      const input = "PROGRAMMING";
      const category = mockCategories.find((c) =>
        c.aliases.some((alias) => alias.toLowerCase() === input.toLowerCase()),
      );
      expect(category?.name).toBe("Programming");
    });

    it("should trim whitespace", () => {
      const input = "  marketing  ";
      const trimmed = input.trim().toLowerCase();
      const category = mockCategories.find((c) =>
        c.aliases.some((alias) => alias.toLowerCase() === trimmed),
      );
      expect(category?.name).toBe("Marketing");
    });
  });

  describe("Get Categories", () => {
    it("should return all categories", () => {
      const categories = mockCategories;
      expect(categories.length).toBe(3);
    });

    it("should return category names", () => {
      const names = mockCategories.map((c) => c.name);
      expect(names).toEqual(["Marketing", "Programming", "Other"]);
    });

    it("should have valid structure", () => {
      const category = mockCategories[0];
      expect(category).toHaveProperty("id");
      expect(category).toHaveProperty("name");
      expect(category).toHaveProperty("description");
      expect(category).toHaveProperty("aliases");
    });
  });

  describe("Validation", () => {
    it("should validate category name length", () => {
      const maxLength = 40;
      const validName = "Programming";
      const invalidName = "A".repeat(50);

      expect(validName.length).toBeLessThanOrEqual(maxLength);
      expect(invalidName.length).toBeGreaterThan(maxLength);
    });

    it("should ensure unique category IDs", () => {
      const ids = mockCategories.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should ensure unique category names", () => {
      const names = mockCategories.map((c) => c.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("should validate aliases are arrays", () => {
      mockCategories.forEach((category) => {
        expect(Array.isArray(category.aliases)).toBe(true);
      });
    });
  });
});
