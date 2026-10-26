import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { classifyAudit, summarizeAudit } from "../scripts/audit-site.js";

const execFileAsync = promisify(execFile);

test("summarizeAudit counts site audit details", () => {
  const summary = summarizeAudit({
    pages: ["index.html", "issues/example/index.html"],
    brokenLinks: [{ page: "index.html", href: "/missing/" }],
    brokenImages: [{ page: "index.html", src: "/missing.jpg" }, { page: "issues/example/index.html", src: "ghost.png" }],
    missingVisibleLabels: [{ page: "index.html", id: "archive-search" }],
    smallTouchTargets: [{ page: "index.html", selector: ".site-nav a" }, { page: "index.html", selector: ".carousel-dot" }],
    mediaAudit: { totalIssues: 42, needsReview: 10 },
    llms: { issueLinks: 20, totalIssues: 42 },
    imagesMissingDimensions: [{ page: "index.html", src: "/cover.jpg" }]
  });

  assert.deepEqual(summary, {
    pages: 2,
    brokenLinks: 1,
    brokenImages: 2,
    missingVisibleLabels: 1,
    smallTouchTargets: 2,
    mediaTotalIssues: 42,
    mediaNeedsReview: 10,
    llmsIssueLinks: 20,
    llmsTotalIssues: 42,
    llmsMissingIssueLinks: 22,
    imagesMissingDimensions: 1
  });
});

test("classifyAudit fails on critical regressions", () => {
  assert.deepEqual(
    classifyAudit({
      pages: 53,
      brokenLinks: 1,
      brokenImages: 0,
      missingVisibleLabels: 0,
      smallTouchTargets: 0,
      mediaTotalIssues: 42,
      mediaNeedsReview: 10,
      llmsIssueLinks: 20,
      llmsTotalIssues: 42,
      llmsMissingIssueLinks: 22,
      imagesMissingDimensions: 545
    }),
    {
      status: "fail",
      failures: [
        "brokenLinks",
        "mediaNeedsReview",
        "llmsMissingIssueLinks",
        "imagesMissingDimensions"
      ]
    }
  );

  assert.deepEqual(
    classifyAudit({
      pages: 53,
      brokenLinks: 0,
      brokenImages: 1,
      missingVisibleLabels: 1,
      smallTouchTargets: 0,
      mediaTotalIssues: 42,
      mediaNeedsReview: 10,
      llmsIssueLinks: 20,
      llmsTotalIssues: 42,
      llmsMissingIssueLinks: 22,
      imagesMissingDimensions: 545
    }),
    {
      status: "fail",
      failures: [
        "brokenImages",
        "missingVisibleLabels",
        "mediaNeedsReview",
        "llmsMissingIssueLinks",
        "imagesMissingDimensions"
      ]
    }
  );
});

test("classifyAudit passes clean summary", () => {
  assert.deepEqual(
    classifyAudit({
      pages: 53,
      brokenLinks: 0,
      brokenImages: 0,
      missingVisibleLabels: 0,
      smallTouchTargets: 0,
      mediaTotalIssues: 42,
      mediaNeedsReview: 0,
      llmsIssueLinks: 42,
      llmsTotalIssues: 42,
      llmsMissingIssueLinks: 0,
      imagesMissingDimensions: 0
    }),
    {
      status: "pass",
      failures: []
    }
  );
});

test("audit CLI flags homepage controls without visible labels and counts relative llms issue links", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-audit-"));
  const outputPath = path.join(rootDir, "audit.json");
  await fs.mkdir(path.join(rootDir, "dist"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "content/issues"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "content/issues/absolute.json"), "{}", "utf8");
  await fs.writeFile(path.join(rootDir, "content/issues/relative.json"), "{}", "utf8");
  await fs.writeFile(
    path.join(rootDir, "dist/index.html"),
    `
      <label for="labeled-control">Visible search</label>
      <input id="labeled-control" aria-label="Screen reader label">
      <input aria-label="Archive search">
      <select id="topic-filter" name="topic"></select>
    `,
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "dist/llms.txt"),
    [
      "https://thedementiatimes.com/issues/absolute/",
      "/issues/relative/",
      "/issues/relative/"
    ].join("\n"),
    "utf8"
  );

  const { stdout } = await execFileAsync(process.execPath, [
    "scripts/audit-site.js",
    "--root",
    rootDir,
    "--output",
    outputPath
  ]);
  const summary = JSON.parse(stdout);
  const report = JSON.parse(await fs.readFile(outputPath, "utf8"));

  assert.equal(summary.missingVisibleLabels, 2);
  assert.equal(summary.llmsIssueLinks, 2);
  assert.equal(summary.llmsMissingIssueLinks, 0);
  assert.deepEqual(
    report.audit.missingVisibleLabels.map((field) => field.identifier),
    ["Archive search", "topic-filter"]
  );
});

test("audit CLI records broken local links and images and exits nonzero in strict mode", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-audit-"));
  const outputPath = path.join(rootDir, "audit.json");
  await fs.mkdir(path.join(rootDir, "dist/assets"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "content/issues"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "dist/index.html"),
    `
      <a href="/missing/">Missing page</a>
      <a href="/bad/%">Malformed page</a>
      <a href="sms:?body=Helpful%20article">Text article</a>
      <img src="/assets/missing.png" width="1" height="1" alt="">
      <img src="/assets/%" width="1" height="1" alt="">
    `,
    "utf8"
  );

  await assert.rejects(
    execFileAsync(process.execPath, [
      "scripts/audit-site.js",
      "--strict",
      "--root",
      rootDir,
      "--output",
      outputPath
    ]),
    (error) => {
      assert.equal(error.code, 1);
      const summary = JSON.parse(error.stdout);
      assert.equal(summary.brokenLinks, 2);
      assert.equal(summary.brokenImages, 2);
      assert.equal(summary.status, "fail");
      return true;
    }
  );

  const report = JSON.parse(await fs.readFile(outputPath, "utf8"));
  assert.deepEqual(
    report.audit.brokenLinks.map((link) => link.href),
    ["/missing/", "/bad/%"]
  );
  assert.deepEqual(
    report.audit.brokenImages.map((image) => image.src),
    ["/assets/missing.png", "/assets/%"]
  );
});
