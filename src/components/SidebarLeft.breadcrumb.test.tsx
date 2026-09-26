import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SidebarLeft } from "./SidebarLeft";
import type { FileNode } from "../features/workspace/types";

const file: FileNode = { name: "note.md", path: "/Essays/note.md", kind: "file" };

function renderPath(folderSegments: string[], onBreadcrumbNavigate = vi.fn()) {
  render(
    <SidebarLeft
      workspaceSelected
      workspaceRoots={[file]}
      workspaceHasData
      breadcrumbVolumeLabel="Macintosh HD"
      breadcrumbRootDisplayLabel="Essays"
      breadcrumbFolderSegments={folderSegments}
      isLoading={false}
      loadError={null}
      selectedPath={null}
      expandedPaths={new Set()}
      searchQuery=""
      onSearchChange={() => {}}
      onToggleFolder={() => {}}
      onSelectNode={() => {}}
      onOpenFolder={() => {}}
      onBreadcrumbNavigate={onBreadcrumbNavigate}
      onWorkspaceNavigateUp={() => {}}
    />,
  );
  return onBreadcrumbNavigate;
}

describe("workspace path ellipsis", () => {
  it("hides the folder menu until the path is nested", () => {
    renderPath([]);
    expect(screen.queryByRole("button", { name: "Show folders in this path" })).not.toBeInTheDocument();
  });

  it("opens the folder hierarchy and navigates to a chosen folder", async () => {
    const user = userEvent.setup();
    const onNavigate = renderPath(["Drafts", "Building a Memorable Essay"]);

    await user.click(screen.getByRole("button", { name: "Show folders in this path" }));

    const menu = screen.getByRole("menu", { name: "Folder hierarchy" });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Essays" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Drafts" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Building a Memorable Essay" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(screen.getByRole("menuitem", { name: "Drafts" }));
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(1);
    expect(screen.queryByRole("menu", { name: "Folder hierarchy" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show folders in this path" }));
    await user.click(screen.getByRole("menuitem", { name: "Essays" }));
    expect(onNavigate).toHaveBeenLastCalledWith(0);

    await user.click(screen.getByRole("button", { name: "Show folders in this path" }));
    await user.click(screen.getByRole("menuitem", { name: "Building a Memorable Essay" }));
    expect(onNavigate).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("menu", { name: "Folder hierarchy" })).not.toBeInTheDocument();
  });

  it("opens workspace folder settings from the volume name", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onOpenVolumeSettings = vi.fn();
    render(
      <SidebarLeft
        workspaceSelected
        workspaceRoots={[file]}
        workspaceHasData
        breadcrumbVolumeLabel="Macintosh HD"
        breadcrumbRootDisplayLabel="Essays"
        breadcrumbFolderSegments={["Drafts"]}
        isLoading={false}
        loadError={null}
        selectedPath={null}
        expandedPaths={new Set()}
        searchQuery=""
        onSearchChange={() => {}}
        onToggleFolder={() => {}}
        onSelectNode={() => {}}
        onOpenFolder={() => {}}
        onBreadcrumbNavigate={onNavigate}
        onWorkspaceNavigateUp={() => {}}
        onOpenVolumeSettings={onOpenVolumeSettings}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Macintosh HD" }));
    expect(onOpenVolumeSettings).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
