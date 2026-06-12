import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "../src/components/theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("persists dark mode preference", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("bookbot-theme")).toBe("dark");
  });
});
