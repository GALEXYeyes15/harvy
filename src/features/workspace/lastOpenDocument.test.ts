import { afterEach, describe, expect, it } from "vitest";
import {
  readLastOpenDocumentRelative,
  rememberLastOpenDocument,
  resolveLastOpenDocumentAbsPath,
  writeLastOpenDocumentRelative,
} from "./lastOpenDocument";

afterEach(() => {
  localStorage.clear();
});

describe("last open document storage", () => {
  it("round-trips a relative path", () => {
    writeLastOpenDocumentRelative("Q3/The dream.md");
    expect(readLastOpenDocumentRelative()).toBe("Q3/The dream.md");
  });

  it("clears when the path is empty", () => {
    writeLastOpenDocumentRelative("Q3/The dream.md");
    writeLastOpenDocumentRelative(null);
    expect(readLastOpenDocumentRelative()).toBeNull();
  });

  it("stores a workspace-relative path from an absolute file", () => {
    rememberLastOpenDocument("/Users/a/Essays", "/Users/a/Essays/Q3/The dream.md");
    expect(readLastOpenDocumentRelative()).toBe("Q3/The dream.md");
  });

  it("clears virtual tabs and paths outside the workspace", () => {
    writeLastOpenDocumentRelative("Q3/The dream.md");
    rememberLastOpenDocument("/Users/a/Essays", "harvy:untitled");
    expect(readLastOpenDocumentRelative()).toBeNull();

    writeLastOpenDocumentRelative("Q3/The dream.md");
    rememberLastOpenDocument("/Users/a/Essays", "/tmp/other.md");
    expect(readLastOpenDocumentRelative()).toBeNull();
  });
});

describe("resolveLastOpenDocumentAbsPath", () => {
  it("joins POSIX and Windows roots", () => {
    expect(resolveLastOpenDocumentAbsPath("/Users/a/Essays", "Q3/The dream.md")).toBe(
      "/Users/a/Essays/Q3/The dream.md",
    );
    expect(resolveLastOpenDocumentAbsPath("C:\\Notes", "Q3/The dream.md")).toBe(
      "C:/Notes/Q3/The dream.md",
    );
  });

  it("rejects empty segments and parent traversal", () => {
    expect(resolveLastOpenDocumentAbsPath("/ws", "")).toBeNull();
    expect(resolveLastOpenDocumentAbsPath("/ws", "../secret.md")).toBeNull();
    expect(resolveLastOpenDocumentAbsPath("/ws", "Q3//doc.md")).toBeNull();
  });
});
