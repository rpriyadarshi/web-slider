import path from "path-browserify";

const posix = path.posix;

/**
 * A path named inside `containerFile`, resolved from that file's directory.
 * `https://` and `data:` are left as written. An absolute path is normalized
 * and not joined. A relative path, including `.` and `..`, is joined to the
 * directory and normalized. This is path.posix.join + path.posix.normalize,
 * not path.resolve, so a site path does not pick up the process cwd.
 */
export function resolvePath(containerFile: string, ref: string): string | null {
  if (ref.startsWith("https://") || ref.startsWith("data:")) return ref;
  if (!ref || ref.includes("\\") || ref.includes("://")) return null;
  if (posix.isAbsolute(ref)) return posix.normalize(ref);
  if (!containerFile.includes("/")) return null;
  return posix.normalize(posix.join(posix.dirname(containerFile), ref));
}
