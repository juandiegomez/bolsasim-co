import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("SDD-001/FND-001: domain and application imports point inward", () => {
  const forbidden: string[] = [];
  for (const layer of ["domain", "application"]) {
    const root = path.resolve("src", layer);
    for (const entry of readdirSync(root, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const file = path.join(entry.parentPath, entry.name);
      const ast = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const specifier = node.moduleSpecifier.text;
          const resolved = specifier.startsWith(".")
            ? path.resolve(path.dirname(file), specifier)
            : specifier.startsWith("@/")
              ? path.resolve("src", specifier.slice(2))
              : specifier;
          const allowed =
            (specifier === "decimal.js" && layer === "domain") ||
            resolved.startsWith(root + path.sep) ||
            (layer === "application" &&
              resolved.startsWith(path.resolve("src/domain") + path.sep));
          if (!allowed) forbidden.push(`${file}: ${specifier}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
  }
  expect(forbidden).toEqual([]);
});
