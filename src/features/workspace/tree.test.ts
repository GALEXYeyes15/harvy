import { describe, expect, it } from "vitest";
import { compareNaturalNames, compareWorkspaceNodes, filterFileTree } from "./tree";
import type { FileNode } from "./types";

describe("compareNaturalNames", () => {
  it("orders week folders by the full day number", () => {
    const names = ["6:14-6:20", "6:21-6:27", "6:28-7:4", "6:7-6:13"];
    names.sort(compareNaturalNames);
    expect(names).toEqual(["6:7-6:13", "6:14-6:20", "6:21-6:27", "6:28-7:4"]);
  });

  it("uses the same order for Finder-style slashes", () => {
    const names = ["6/14-6/20", "6/21-6/27", "6/28-7/4", "6/7-6/13"];
    names.sort(compareNaturalNames);
    expect(names).toEqual(["6/7-6/13", "6/14-6/20", "6/21-6/27", "6/28-7/4"]);
  });
});

describe("filterFileTree", () => {
  it("sorts sibling directories with numeric names", () => {
    const nodes: FileNode[] = [
      { name: "6:14-6:20", path: "/a/6:14-6:20", kind: "directory", children: [] },
      { name: "6:7-6:13", path: "/a/6:7-6:13", kind: "directory", children: [] },
      { name: "6:21-6:27", path: "/a/6:21-6:27", kind: "directory", children: [] },
    ];
    expect(filterFileTree(nodes).map((n) => n.name)).toEqual([
      "6:7-6:13",
      "6:14-6:20",
      "6:21-6:27",
    ]);
  });

  it("keeps directories before files", () => {
    const nodes: FileNode[] = [
      { name: "notes.md", path: "/a/notes.md", kind: "file" },
      { name: "Archive", path: "/a/Archive", kind: "directory", children: [] },
    ];
    expect(filterFileTree(nodes).map((n) => n.name)).toEqual(["Archive", "notes.md"]);
  });
});

describe("compareWorkspaceNodes", () => {
  it("orders directories ahead of files regardless of name", () => {
    expect(
      compareWorkspaceNodes(
        { name: "zeta.md", path: "/z", kind: "file" },
        { name: "alpha", path: "/a", kind: "directory" },
      ),
    ).toBeGreaterThan(0);
  });
});
