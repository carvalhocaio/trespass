import { scanFileForPatterns } from "@server/services/scanner/sast-patterns";
import { scanFileForSecrets } from "@server/services/scanner/secrets-detector";
import { bench, describe } from "vitest";

// Generate realistic file content for benchmarks
function makeFile(lines: number): string {
  const clean = [
    'import { createServer } from "node:http"',
    "const PORT = process.env.PORT ?? 3000",
    "function handler(req, res) {",
    '  const url = new URL(req.url, "http://localhost:3000")',
    "  res.writeHead(200)",
    "  res.end('OK')",
    "}",
    "createServer(handler).listen(PORT)",
  ];
  return Array.from({ length: Math.ceil(lines / clean.length) }, () => clean)
    .flat()
    .slice(0, lines)
    .join("\n");
}

const FILE_100 = makeFile(100);
const FILE_500 = makeFile(500);
const FILE_1000 = makeFile(1000);

describe("scanFileForSecrets performance", () => {
  bench("100 lines", () => {
    scanFileForSecrets(FILE_100, "app.ts");
  });

  bench("500 lines", () => {
    scanFileForSecrets(FILE_500, "app.ts");
  });

  bench("1000 lines", () => {
    scanFileForSecrets(FILE_1000, "app.ts");
  });
});

describe("scanFileForPatterns performance", () => {
  bench("100 lines", () => {
    scanFileForPatterns(FILE_100, "app.ts");
  });

  bench("500 lines", () => {
    scanFileForPatterns(FILE_500, "app.ts");
  });

  bench("1000 lines", () => {
    scanFileForPatterns(FILE_1000, "app.ts");
  });
});
