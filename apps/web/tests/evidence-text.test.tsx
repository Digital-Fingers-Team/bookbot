import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceText } from "../src/components/evidence-text";

describe("EvidenceText", () => {
  it("renders marked keyword spans from backend highlights", () => {
    render(
      <p>
        <EvidenceText
          text="Hybrid search ranks exact keywords and fuzzy matches."
          highlights={[{ term: "keywords", start: 26, end: 34 }]}
        />
      </p>
    );

    expect(screen.getByText("keywords").tagName).toBe("MARK");
  });
});
