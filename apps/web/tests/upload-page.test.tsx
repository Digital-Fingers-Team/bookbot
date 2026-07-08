import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/components/auth-provider", () => ({
  useAuth: () => ({
    token: "admin-token",
    user: { id: "1", name: "Admin", email: "admin@example.com", role: "admin" },
    isAdmin: true,
    loading: false
  })
}));

import UploadPage from "../src/app/upload/page";
import { LanguageProvider } from "../src/lib/i18n";

// The component reads its strings from LanguageProvider, which defaults to
// Arabic and only switches to the saved language after mount. Force English
// via localStorage so assertions below can match plain English copy.
beforeEach(() => {
  localStorage.setItem("bookbot-lang", "en");
});

// This project's vitest config doesn't enable `globals`, so
// @testing-library/react's automatic afterEach cleanup never registers —
// without this, each render()'s DOM (and its file <input>) stays mounted
// alongside the next test's, and querySelector below grabs the stale one.
afterEach(() => {
  cleanup();
});

function renderUploadPage() {
  return render(
    <LanguageProvider>
      <UploadPage />
    </LanguageProvider>
  );
}

describe("UploadPage", () => {
  it("rejects unsupported files before upload", async () => {
    renderUploadPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["not supported"], "notes.exe", { type: "application/octet-stream" });
    await userEvent.upload(input, file, { applyAccept: false });

    expect(
      await screen.findByText('"notes.exe" is not a supported file type. Please upload PDF, EPUB, DOCX, or TXT.')
    ).toBeTruthy();
  });

  it("queues multiple PDF files before upload", async () => {
    renderUploadPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, [
      new File(["pdf one"], "first.pdf", { type: "application/pdf" }),
      new File(["pdf two"], "second.pdf", { type: "application/pdf" })
    ]);

    expect(await screen.findByText("2 books ready")).toBeTruthy();
    expect(screen.getByText("first.pdf")).toBeTruthy();
    expect(screen.getByText("second.pdf")).toBeTruthy();
  });

  it("accepts EPUB, DOCX, and TXT files", async () => {
    renderUploadPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, [
      new File(["epub"], "book.epub", { type: "application/epub+zip" }),
      new File(["docx"], "book.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }),
      new File(["txt"], "book.txt", { type: "text/plain" })
    ], { applyAccept: false });

    expect(await screen.findByText("3 books ready")).toBeTruthy();
    expect(screen.getByText("book.epub")).toBeTruthy();
    expect(screen.getByText("book.docx")).toBeTruthy();
    expect(screen.getByText("book.txt")).toBeTruthy();
  });
});
