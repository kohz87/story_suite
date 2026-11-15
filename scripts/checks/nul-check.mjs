/**
 * Returns the problem message for a text file whose content holds a NUL byte, or null. Files with a
 * known binary extension never reach this check; a NUL inside source must not hide it from the checks.
 */
export function nulProblem(filePath, text) {
  return text.includes('\0') ? `${filePath}: contains a NUL byte; text files must not` : null;
}
