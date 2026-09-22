import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReaderGuard } from "../src/components/reader-guard";

function book() {
  return <div data-testid="book">page</div>;
}

function cover() {
  return screen.queryByTestId("reader-guard-cover");
}

describe("ReaderGuard", () => {
  afterEach(() => {
    cleanup();
    delete document.body.dataset.reading;
  });

  it("shows the book until something suggests a capture", () => {
    render(<ReaderGuard>{book()}</ReaderGuard>);

    expect(screen.getByTestId("book")).toBeTruthy();
    expect(cover()).toBeNull();
  });

  it("covers the book when the window loses focus", () => {
    render(<ReaderGuard>{book()}</ReaderGuard>);

    fireEvent.blur(window);

    expect(cover()).not.toBeNull();
  });

  it("covers the book on PrintScreen", () => {
    render(<ReaderGuard>{book()}</ReaderGuard>);

    fireEvent.keyDown(document, { key: "PrintScreen" });

    expect(cover()).not.toBeNull();
  });

  it("covers the book on the macOS screenshot shortcut", () => {
    render(<ReaderGuard>{book()}</ReaderGuard>);

    fireEvent.keyDown(document, { key: "4", metaKey: true, shiftKey: true });

    expect(cover()).not.toBeNull();
  });

  it("blocks print and covers the book", () => {
    render(<ReaderGuard>{book()}</ReaderGuard>);

    const blocked = !fireEvent.keyDown(document, { key: "p", ctrlKey: true, cancelable: true });

    expect(blocked).toBe(true);
    expect(cover()).not.toBeNull();
  });

  // Uncovering is a deliberate click, so a tool that flicks focus away and back
  // cannot silently reveal the book again.
  it("only uncovers on an explicit click", () => {
    render(<ReaderGuard>{book()}</ReaderGuard>);

    fireEvent.blur(window);
    fireEvent.focus(window);
    expect(cover()).not.toBeNull();

    fireEvent.click(cover() as HTMLElement);
    expect(cover()).toBeNull();
  });

  it("blocks the context menu and copying", () => {
    render(<ReaderGuard>{book()}</ReaderGuard>);

    expect(fireEvent.contextMenu(document, { cancelable: true })).toBe(false);
    expect(fireEvent.copy(document, { cancelable: true })).toBe(false);
  });

  it("marks the document so the print stylesheet withholds the page", () => {
    const view = render(<ReaderGuard>{book()}</ReaderGuard>);

    expect(document.body.dataset.reading).toBe("true");

    view.unmount();
    expect(document.body.dataset.reading).toBeUndefined();
  });
});
