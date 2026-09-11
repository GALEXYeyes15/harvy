import { describe, expect, it } from "vitest";
import { suggestedSaveAsFileName, resolveRenamedDocumentPath } from "./saveRuntime";

describe("suggestedSaveAsFileName", () => {
  it("uses an in-progress header rename before the previous file name", () => {
    expect(
      suggestedSaveAsFileName({
        pendingRenameBase: "My Essay",
        fileTitle: "Untitled",
        postTitle: "",
      }),
    ).toBe("My Essay.md");
  });

  it("uses the file/tab name before in-document Title", () => {
    expect(
      suggestedSaveAsFileName({
        fileTitle: "Renamed Doc.md",
        postTitle: "YAML Title",
      }),
    ).toBe("Renamed Doc.md");
  });

  it("falls back to in-document Title when the file is still untitled", () => {
    expect(
      suggestedSaveAsFileName({
        fileTitle: "",
        postTitle: "From Title Field",
      }),
    ).toBe("From Title Field.md");
  });
});

describe("resolveRenamedDocumentPath", () => {
  it("renames Test.md to asdf.md when the document name changed", () => {
    expect(resolveRenamedDocumentPath("/Essays/8-30/Test.md", "asdf")).toBe(
      "/Essays/8-30/asdf.md",
    );
    expect(resolveRenamedDocumentPath("/Essays/8-30/Test.md", "asdf.md")).toBe(
      "/Essays/8-30/asdf.md",
    );
  });

  it("returns null when the on-disk name already matches", () => {
    expect(resolveRenamedDocumentPath("/Essays/Test.md", "Test")).toBeNull();
    expect(resolveRenamedDocumentPath("/Essays/Test.md", "Test.md")).toBeNull();
  });
});
