import { isMacOSPlatform } from "../save/saveRuntime";

/**
 * macOS stores a Finder `/` in a file or folder name as `:` on disk.
 * Convert a POSIX path segment for display to match Finder.
 */
export function posixSegmentToFinderName(name: string, mac = isMacOSPlatform()): string {
  if (!mac) return name;
  return name.replaceAll(":", "/");
}

/**
 * Inverse of {@link posixSegmentToFinderName} for rename commits.
 */
export function finderNameToPosixSegment(name: string, mac = isMacOSPlatform()): string {
  if (!mac) return name;
  return name.replaceAll("/", ":");
}
