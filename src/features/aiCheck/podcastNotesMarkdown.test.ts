import { describe, expect, it } from "vitest";
import { ensurePodcastNotesBullets } from "./podcastNotesMarkdown";

describe("ensurePodcastNotesBullets", () => {
  it("turns section paragraphs into a tight bullet list", () => {
    expect(
      ensurePodcastNotesBullets(
        [
          "# From Victim to Villain",
          "",
          "## The Wake-Up Call",
          "",
          "The host had recently gone through a lot.",
          "",
          "The friend specifically valued the host's optimism.",
          "",
          "The host realized they had become a villain in their own story.",
          "",
          "## The Storytelling Realization",
          "",
          "A later point.",
        ].join("\n"),
      ),
    ).toBe(
      [
        "# From Victim to Villain",
        "",
        "## The Wake-Up Call",
        "",
        "- The host had recently gone through a lot.",
        "- The friend specifically valued the host's optimism.",
        "- The host realized they had become a villain in their own story.",
        "",
        "## The Storytelling Realization",
        "",
        "- A later point.",
        "",
      ].join("\n"),
    );
  });

  it("normalizes existing list markers to dashes", () => {
    expect(ensurePodcastNotesBullets("## Hook\n\n* One\n1. Two\n+ Three\n")).toBe(
      "## Hook\n\n- One\n- Two\n- Three\n",
    );
  });

  it("leaves headings alone", () => {
    expect(ensurePodcastNotesBullets("# Title\n\n## Section\n")).toBe("# Title\n\n## Section\n");
  });
});
