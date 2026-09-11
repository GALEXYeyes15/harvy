import { describe, expect, it } from "vitest";
import type { FileNode } from "./types";
import {
  isExactOpenDocument,
  isOpenDocumentInside,
  marksOpenDocumentTrail,
  resolveOpenDocumentPath,
  visibleOpenDocumentTrailPath,
} from "./openDocumentTrail";

describe("resolveOpenDocumentPath", () => {
  it("prefers the document source path over a virtual tab id", () => {
    expect(
      resolveOpenDocumentPath({
        sourcePath: "/ws/Essays/Q3/doc.md",
        tabId: "harvy:untitled",
        isVirtualTabId: (id) => id.startsWith("harvy:"),
      }),
    ).toBe("/ws/Essays/Q3/doc.md");
  });

  it("prefers a real tab id over a drifted source path", () => {
    expect(
      resolveOpenDocumentPath({
        sourcePath: "/private/Users/a/Essays/Q3/doc.md",
        tabId: "/Users/a/Essays/Q3/doc.md",
        isVirtualTabId: (id) => id.startsWith("harvy:"),
      }),
    ).toBe("/Users/a/Essays/Q3/doc.md");
  });
});

describe("path matching", () => {
  it("treats /private/Users as the same as /Users", () => {
    expect(
      isExactOpenDocument("/Users/a/Essays/The dream.md", "/private/Users/a/Essays/The dream.md"),
    ).toBe(true);
    expect(
      isOpenDocumentInside("/Users/a/Essays/Q3", "/private/Users/a/Essays/Q3/8/2026/doc.md"),
    ).toBe(true);
  });

  it("matches through the workspace root when prefixes differ", () => {
    expect(
      isOpenDocumentInside("/Users/a/Essays/Q3", "/private/Users/a/Essays/Q3/doc.md", "/Users/a/Essays"),
    ).toBe(true);
  });

  it("treats Finder colons and slashes as the same folder name", () => {
    expect(
      isOpenDocumentInside(
        "/Users/a/Essays/Q3/8:2026",
        "/Users/a/Essays/Q3/8/2026/8:16-8:22/doc.md",
      ),
    ).toBe(true);
    expect(
      isExactOpenDocument(
        "/Users/a/Essays/Q3/8:2026/The dream.md",
        "/Users/a/Essays/Q3/8/2026/The dream.md",
      ),
    ).toBe(true);
  });

  it("matches a folder when the open file uses a different prefix alias", () => {
    expect(
      isOpenDocumentInside(
        "/Users/a/Library/CloudStorage/Dropbox/Essays/Q3",
        "/Users/a/Dropbox/Essays/Q3/8:2026/doc.md",
      ),
    ).toBe(true);
  });
});

describe("marksOpenDocumentTrail", () => {
  const open = "/ws/Essays/Q3/8/2026/The dream.md";

  it("marks the file when it is visible", () => {
    expect(
      marksOpenDocumentTrail({
        nodePath: open,
        isDirectory: false,
        isExpanded: false,
        childPaths: [],
        openDocumentPath: open,
      }),
    ).toBe(true);
  });

  it("marks a collapsed folder that contains the file", () => {
    expect(
      marksOpenDocumentTrail({
        nodePath: "/ws/Essays/Q3",
        isDirectory: true,
        isExpanded: false,
        childPaths: ["/ws/Essays/Q3/8"],
        openDocumentPath: open,
      }),
    ).toBe(true);
  });

  it("does not mark an expanded folder when a child still contains the file", () => {
    expect(
      marksOpenDocumentTrail({
        nodePath: "/ws/Essays/Q3",
        isDirectory: true,
        isExpanded: true,
        childPaths: ["/ws/Essays/Q3/8"],
        openDocumentPath: open,
      }),
    ).toBe(false);
  });

  it("does not mark a sibling folder", () => {
    expect(
      marksOpenDocumentTrail({
        nodePath: "/ws/Essays/Q1",
        isDirectory: true,
        isExpanded: false,
        childPaths: [],
        openDocumentPath: open,
      }),
    ).toBe(false);
  });
});

describe("visibleOpenDocumentTrailPath", () => {
  const q3: FileNode = {
    name: "Q3",
    path: "/ws/Essays/Q3",
    kind: "directory",
    children: [
      {
        name: "8:2026",
        path: "/ws/Essays/Q3/8:2026",
        kind: "directory",
        children: [
          {
            name: "The dream.md",
            path: "/ws/Essays/Q3/8:2026/The dream.md",
            kind: "file",
          },
        ],
      },
    ],
  };
  const roots: FileNode[] = [
    { name: "Q1", path: "/ws/Essays/Q1", kind: "directory", children: [] },
    q3,
    { name: "The dream.md", path: "/ws/Essays/The dream.md", kind: "file" },
  ];

  it("marks a collapsed quarter folder that contains the open file", () => {
    expect(
      visibleOpenDocumentTrailPath(roots, new Set(), "/ws/Essays/Q3/8:2026/The dream.md"),
    ).toBe("/ws/Essays/Q3");
  });

  it("marks the visible file when that is the open document", () => {
    expect(visibleOpenDocumentTrailPath(roots, new Set(), "/ws/Essays/The dream.md")).toBe(
      "/ws/Essays/The dream.md",
    );
  });

  it("moves the mark inward after the parent folder is expanded", () => {
    expect(
      visibleOpenDocumentTrailPath(
        roots,
        new Set(["/ws/Essays/Q3"]),
        "/private/Users/unused/Essays/Q3/8:2026/The dream.md",
      ),
    ).toBe("/ws/Essays/Q3/8:2026");
  });
});
