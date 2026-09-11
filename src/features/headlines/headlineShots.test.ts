import { describe, expect, it } from "vitest";
import { parseHeadlineShots } from "./headlineShots";
import { imagePathsFromFiles, parseHeadlineDataUrl } from "./headlineScreenshotAssets";

describe("parseHeadlineShots", () => {
  it("keeps valid screenshot records", () => {
    expect(
      parseHeadlineShots([
        { id: "a", src: "/tmp/hl.png", createdAt: 12 },
        { id: "b", src: "data:image/png;base64,abc" },
      ]),
    ).toEqual([
      { id: "a", src: "/tmp/hl.png", createdAt: 12 },
      { id: "b", src: "data:image/png;base64,abc", createdAt: expect.any(Number) },
    ]);
  });

  it("drops malformed entries", () => {
    expect(
      parseHeadlineShots([
        null,
        { id: "", src: "/tmp/x.png" },
        { id: "ok", src: "" },
        { src: "/tmp/x.png" },
        { id: "ok", src: "/tmp/ok.png", createdAt: 3 },
      ]),
    ).toEqual([{ id: "ok", src: "/tmp/ok.png", createdAt: 3 }]);
  });
});

describe("parseHeadlineDataUrl", () => {
  it("reads a data URL payload", () => {
    expect(parseHeadlineDataUrl("data:image/png;base64,abc123")).toEqual({
      mimeType: "image/png",
      dataBase64: "abc123",
    });
  });

  it("normalizes jpg and strips whitespace", () => {
    expect(parseHeadlineDataUrl("data:image/jpg;base64,ab cd")).toEqual({
      mimeType: "image/jpeg",
      dataBase64: "abcd",
    });
  });
});

describe("imagePathsFromFiles", () => {
  it("keeps image files that include a filesystem path", () => {
    const png = { name: "shot.png", path: "/tmp/shot.png" } as File & { path?: string };
    const txt = { name: "notes.txt", path: "/tmp/notes.txt" } as File & { path?: string };
    const noPath = { name: "clip.png" } as File & { path?: string };
    expect(imagePathsFromFiles([png, txt, noPath])).toEqual(["/tmp/shot.png"]);
  });
});
