import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import UploadPage from "../src/app/upload/page";

describe("UploadPage", () => {
  it("rejects non-PDF files before upload", async () => {
    render(<UploadPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["not a pdf"], "notes.txt", { type: "text/plain" });
    await userEvent.upload(input, file, { applyAccept: false });

    expect(await screen.findByText("Please choose a PDF file.")).toBeTruthy();
  });
});
