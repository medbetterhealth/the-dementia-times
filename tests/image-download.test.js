import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  downloadIssueImages,
  imageExtensionFromContentType,
  localIssueImagePath,
  remoteImageToLocalMetadata
} from "../src/lib/image-download.js";

test("imageExtensionFromContentType maps supported image content types", () => {
  assert.equal(imageExtensionFromContentType("image/jpeg"), ".jpg");
  assert.equal(imageExtensionFromContentType("image/png"), ".png");
  assert.equal(imageExtensionFromContentType("image/gif"), ".gif");
  assert.equal(imageExtensionFromContentType("image/webp"), ".webp");
  assert.equal(imageExtensionFromContentType("image/jpeg; charset=binary"), ".jpg");
});

test("localIssueImagePath returns stable issue asset paths", () => {
  assert.equal(localIssueImagePath("example-issue", 0, ".jpg"), "public/assets/issues/example-issue/cover.jpg");
  assert.equal(localIssueImagePath("example-issue", 2, ".png"), "public/assets/issues/example-issue/image-2.png");
});

test("localIssueImagePath rejects slugs that are not safe issue slugs", () => {
  assert.throws(() => localIssueImagePath("../outside", 0, ".jpg"), /Invalid issue slug/);
  assert.throws(() => localIssueImagePath("Example Issue", 0, ".jpg"), /Invalid issue slug/);
});

test("remoteImageToLocalMetadata returns public issue image metadata", () => {
  assert.deepEqual(remoteImageToLocalMetadata("example-issue", 1, ".jpg", "Slide one"), {
    src: "/assets/issues/example-issue/image-1.jpg",
    alt: "Slide one"
  });
});

test("remoteImageToLocalMetadata rejects slugs that are not safe issue slugs", () => {
  assert.throws(() => remoteImageToLocalMetadata("../outside", 1, ".jpg", "Slide one"), /Invalid issue slug/);
});

test("downloadIssueImages writes remote images and returns local cover and image metadata", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-images-"));
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x0d]),
    Buffer.from("IHDR"),
    Buffer.from([0x00, 0x00, 0x02, 0x80, 0x00, 0x00, 0x01, 0x68]),
    Buffer.from([0x08, 0x02, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0x00])
  ]);
  const responses = new Map([
    [
      "https://media.licdn.com/cover.jpg",
      { body: Buffer.from("cover-bytes"), contentType: "image/jpeg; charset=binary" }
    ],
    ["https://media.licdn.com/slide.png", { body: png, contentType: "image/png" }]
  ]);

  const result = await downloadIssueImages({
    rootDir,
    slug: "example-issue",
    remoteImages: [
      { src: "https://media.licdn.com/cover.jpg", alt: "Cover" },
      { src: "https://media.licdn.com/slide.png", alt: "Slide one" }
    ],
    fetchImpl: async (url) => {
      const response = responses.get(url);
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name.toLowerCase() === "content-type" ? response.contentType : null)
        },
        arrayBuffer: async () => response.body
      };
    }
  });

  assert.deepEqual(result, {
    coverImage: "/assets/issues/example-issue/cover.jpg",
    images: [{ src: "/assets/issues/example-issue/image-1.png", alt: "Slide one", width: 640, height: 360 }]
  });
  assert.equal(
    await fs.readFile(path.join(rootDir, "public/assets/issues/example-issue/cover.jpg"), "utf8"),
    "cover-bytes"
  );
  assert.deepEqual(
    await fs.readFile(path.join(rootDir, "public/assets/issues/example-issue/image-1.png")),
    png
  );
});

test("downloadIssueImages rejects unsafe issue slugs before fetching", async () => {
  let fetched = false;

  await assert.rejects(
    () =>
      downloadIssueImages({
        rootDir: process.cwd(),
        slug: "../outside",
        remoteImages: [{ src: "https://media.licdn.com/cover.jpg", alt: "Cover" }],
        fetchImpl: async () => {
          fetched = true;
          return {
            ok: true,
            status: 200,
            headers: {
              get: () => "image/jpeg"
            },
            arrayBuffer: async () => Buffer.from("cover")
          };
        }
      }),
    /Invalid issue slug/
  );

  assert.equal(fetched, false);
});

test("downloadIssueImages throws for unsupported content type", async () => {
  await assert.rejects(
    () =>
      downloadIssueImages({
        rootDir: process.cwd(),
        slug: "example-issue",
        remoteImages: [{ src: "https://media.licdn.com/file.svg", alt: "Vector" }],
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          headers: {
            get: () => "image/svg+xml"
          },
          arrayBuffer: async () => Buffer.from("svg")
        })
      }),
    /Unsupported image content type/
  );
});
