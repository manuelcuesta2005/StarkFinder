export const extractImports = (code: string): string[] => {
  const importRegex = /use\s+([\w:]+);/g;
  const matches = [...code.matchAll(importRegex)];
  return matches.map((m) => m[1]);
};

export const generateScarb = (deeps: string[]): string => {
  const sanitizeDeeps = deeps.map((dep) => dep.replace(/[^a-zA-Z0-9:_-]/g, ""))
  const uniqueDeeps = Array.from(new Set(sanitizeDeeps))
  const deepFormatted = uniqueDeeps
    .map((dep) => {
      const name = dep.split("::")[0];
      return `${name} = "2.9.1"`
    })
    .join("\n");
  return `[package]
    name = "GeneratedContract"
    version = "0.1.0"
    
    [dependencies]
    ${deepFormatted}`
}