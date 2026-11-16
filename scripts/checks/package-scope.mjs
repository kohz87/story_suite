/**
 * Checks package.json scopes. The root file must say "type": "module" (own code is ES modules); a
 * package.json anywhere else is only allowed under a package root (scripts/layout.json), because a nearer one could change how
 * Node reads the code beneath it. `paths` are repo-relative; `readText` returns a file's text.
 */
export function packageScopeProblems(paths, readText, isPackageFile = p => p.startsWith('packages/')) {
  const problems = [];
  for (const filePath of paths) {
    if (filePath === 'package.json') {
      let type;
      try { type = JSON.parse(readText(filePath)).type; } catch { type = undefined; }
      if (type !== 'module') problems.push('package.json: the root package.json must have "type": "module"');
    } else if (/(^|\/)package\.json$/.test(filePath) && !isPackageFile(filePath)) {
      problems.push(`${filePath}: nested package.json is not allowed here`);
    }
  }
  return problems.sort();
}
