import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "../src/components/theme-toggle";
import { STRINGS } from "../src/lib/i18n";

// The button's label is translated, and Arabic is the default language outside
// a provider. Take the name from the same table the component reads, so this
// keeps passing when the wording is edited.
const TOGGLE_LABEL = STRINGS["common.toggleTheme"].ar;

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("persists dark mode preference", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: TOGGLE_LABEL }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("bookbot-theme")).toBe("dark");
  });
});
