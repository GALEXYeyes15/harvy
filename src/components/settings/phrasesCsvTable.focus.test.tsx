import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CenteredOverlayModal } from "../overlay/CenteredOverlayModal";
import { PhrasesCsvTable } from "./PhrasesCsvTable";
import { isEditableKeyboardTarget } from "../../lib/isEditableKeyboardTarget";
import type { EncouragementPhrase } from "../../features/encouragement/encouragementSettings";

function PhrasesHarness({
  initial,
}: {
  initial: EncouragementPhrase[];
}) {
  const [phrases, setPhrases] = useState(initial);

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          setPhrases((prev) => [
            ...prev,
            {
              id: `enc-new-${prev.length}`,
              text: "",
              author: "",
            },
          ])
        }
      >
        Add row
      </button>
      <PhrasesCsvTable
        phrases={phrases}
        onUpdate={(id, partial) => {
          setPhrases((prev) =>
            prev.map((phrase) => (phrase.id === id ? { ...phrase, ...partial } : phrase)),
          );
        }}
        onRemove={(id) => setPhrases((prev) => prev.filter((p) => p.id !== id))}
      />
    </div>
  );
}

function quoteInput(phraseId?: string) {
  const selector = phraseId
    ? `[data-phrase-field="quote"][data-phrase-id="${phraseId}"]`
    : '[data-phrase-field="quote"]';
  return document.querySelector<HTMLInputElement>(selector)!;
}

function authorInput(phraseId?: string) {
  const selector = phraseId
    ? `[data-phrase-field="author"][data-phrase-id="${phraseId}"]`
    : '[data-phrase-field="author"]';
  return document.querySelector<HTMLInputElement>(selector)!;
}

describe("PhrasesCsvTable focus while typing", () => {
  it("keeps Quote focused after typing several characters and does not remount the input", async () => {
    const user = userEvent.setup();
    render(<PhrasesHarness initial={[{ id: "enc-1", text: "", author: "" }]} />);

    const quote = quoteInput("enc-1");
    quote.focus();
    expect(document.activeElement).toBe(quote);

    await user.type(quote, "hello");

    expect(document.activeElement).toBe(quote);
    expect(quote).toHaveValue("hello");
    expect(quote).toHaveAttribute("data-phrase-id", "enc-1");
  });

  it("keeps Said by focused after typing several characters", async () => {
    const user = userEvent.setup();
    render(<PhrasesHarness initial={[{ id: "enc-2", text: "Hi", author: "" }]} />);

    const author = authorInput("enc-2");
    author.focus();
    expect(document.activeElement).toBe(author);

    await user.type(author, "Alex");

    expect(document.activeElement).toBe(author);
    expect(author).toHaveValue("Alex");
  });

  it("updates the correct row without remounting when typing", async () => {
    const user = userEvent.setup();
    render(
      <PhrasesHarness
        initial={[
          { id: "enc-a", text: "", author: "" },
          { id: "enc-b", text: "Other", author: "Sam" },
        ]}
      />,
    );

    const first = quoteInput("enc-a");
    const second = quoteInput("enc-b");
    first.focus();
    await user.type(first, "One");

    expect(document.activeElement).toBe(first);
    expect(first).toHaveValue("One");
    expect(second).toHaveValue("Other");
    expect(first).toHaveAttribute("data-phrase-id", "enc-a");
    expect(second).toHaveAttribute("data-phrase-id", "enc-b");
  });

  it("lets a newly added row accept typing immediately", async () => {
    const user = userEvent.setup();
    render(<PhrasesHarness initial={[]} />);

    await user.click(screen.getByRole("button", { name: "Add row" }));
    const quote = quoteInput("enc-new-0");
    quote.focus();
    await user.type(quote, "fresh");

    expect(document.activeElement).toBe(quote);
    expect(quote).toHaveValue("fresh");
  });

  it("does not treat phrase fields as targets for app-level shortcuts", async () => {
    const user = userEvent.setup();
    let shortcutRan = false;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (isEditableKeyboardTarget(e.target)) return;
      if (e.key.toLowerCase() === "s") shortcutRan = true;
    };
    window.addEventListener("keydown", onKeyDown);

    render(<PhrasesHarness initial={[{ id: "enc-3", text: "", author: "" }]} />);
    const quote = quoteInput("enc-3");
    quote.focus();
    await user.keyboard("{Meta>}s{/Meta}");

    expect(shortcutRan).toBe(false);
    expect(document.activeElement).toBe(quote);

    window.removeEventListener("keydown", onKeyDown);
  });
});

describe("CenteredOverlayModal does not steal focus on parent re-render", () => {
  it("leaves a focused input alone when onClose identity changes", async () => {
    const user = userEvent.setup();

    function ModalHostUnstableClose() {
      const [tick, setTick] = useState(0);
      const [value, setValue] = useState("");

      return (
        <CenteredOverlayModal
          open
          onClose={() => {
            void tick;
          }}
          title="Settings"
          titleId="settings-test-title"
          backdropLabel="Dismiss"
          closeLabel="Close settings"
          autoFocusCloseButton
        >
          <input
            aria-label="Phrase quote"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setTick((n) => n + 1);
            }}
          />
        </CenteredOverlayModal>
      );
    }

    render(<ModalHostUnstableClose />);

    await waitFor(() => {
      expect(screen.getByLabelText("Close settings")).toHaveFocus();
    });

    const quote = screen.getByLabelText("Phrase quote");
    await user.click(quote);
    expect(quote).toHaveFocus();

    await user.type(quote, "stay");

    expect(quote).toHaveFocus();
    expect(quote).toHaveValue("stay");
  });
});
