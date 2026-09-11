import { describe, expect, it } from "vitest";
import {
  documentCriteriaSidecarPath,
  projectCriteriaFileName,
  projectCriteriaPath,
} from "./documentCriteria";

describe("documentCriteria", () => {
  it("names the project-folder criteria file from the essay leaf", () => {
    expect(projectCriteriaFileName("Ambition.md")).toBe("Ambition Criteria.md");
  });

  it("puts project criteria under Notes when the essay lives in a project folder", () => {
    expect(projectCriteriaPath("/Essays/Ambition/Ambition.md")).toBe(
      "/Essays/Ambition/Notes/Ambition Criteria.md",
    );
  });

  it("has no project criteria path for a standalone essay", () => {
    expect(projectCriteriaPath("/Essays/Ambition.md")).toBeNull();
  });

  it("uses a sidecar next to standalone essays", () => {
    expect(documentCriteriaSidecarPath("/Essays/Ambition.md")).toBe(
      "/Essays/Ambition.md.harvy-criteria",
    );
  });
});
