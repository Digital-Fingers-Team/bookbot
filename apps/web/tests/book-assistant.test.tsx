import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookAssistant } from "../src/components/book-assistant";

const { streamQuestion } = vi.hoisted(() => ({
  streamQuestion: vi.fn(async (_input: unknown, handlers: { onDone?: (value: { answer: string; usage: { retrievedChunks: number } }) => void }) => {
    handlers.onDone?.({ answer: "The answer", usage: { retrievedChunks: 1 } });
  })
}));

vi.mock("../src/lib/api", () => ({
  getBookConversation: vi.fn().mockResolvedValue({ messages: [] }),
  saveBookConversation: vi.fn().mockResolvedValue({ ok: true }),
  streamQuestion
}));

vi.mock("../src/components/auth-provider", () => ({
  useAuth: () => ({ token: "test-token" })
}));

vi.mock("../src/lib/i18n", () => ({
  AI_NAME: "zaky",
  useT: () => (key: string) => key
}));

describe("BookAssistant", () => {
  it("sends the typed question when the send button is clicked", async () => {
    const user = userEvent.setup();
    render(<BookAssistant bookId="book-1" currentPage={3} onJumpToPage={vi.fn()} />);

    const input = screen.getByPlaceholderText("read.askPlaceholder");
    await user.type(input, "What is this book about?");
    await user.click(screen.getByRole("button", { name: "ask.title" }));

    await waitFor(() => expect(streamQuestion).toHaveBeenCalled());
    expect(streamQuestion).toHaveBeenLastCalledWith(
      expect.objectContaining({
        question: "What is this book about?",
        bookId: "book-1",
        page: 3
      }),
      expect.anything(),
      "test-token"
    );
  });
});
