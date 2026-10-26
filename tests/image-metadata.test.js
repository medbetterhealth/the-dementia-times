import test from "node:test";
import assert from "node:assert/strict";
import { imageDimensionsFromBuffer } from "../src/lib/image-metadata.js";

test("imageDimensionsFromBuffer reads PNG IHDR dimensions", () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x0d]),
    Buffer.from("IHDR"),
    Buffer.from([0x00, 0x00, 0x01, 0x40, 0x00, 0x00, 0x00, 0xf0]),
    Buffer.from([0x08, 0x02, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0x00])
  ]);

  assert.deepEqual(imageDimensionsFromBuffer(png, "image/png"), { width: 320, height: 240 });
});

test("imageDimensionsFromBuffer reads GIF logical screen dimensions", () => {
  const gif = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    0x80, 0x02, 0x68, 0x01,
    0x00, 0x00, 0x00
  ]);

  assert.deepEqual(imageDimensionsFromBuffer(gif, "image/gif"), { width: 640, height: 360 });
});

test("imageDimensionsFromBuffer reads JPEG SOF dimensions", () => {
  const jpeg = Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    0x03, 0x00, 0x04, 0x00,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9
  ]);

  assert.deepEqual(imageDimensionsFromBuffer(jpeg, "image/jpeg"), { width: 1024, height: 768 });
});

test("imageDimensionsFromBuffer reads WebP VP8X canvas dimensions", () => {
  const webp = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0x1e, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP"),
    Buffer.from("VP8X"),
    Buffer.from([0x0a, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from([0x3f, 0x01, 0x00]),
    Buffer.from([0xef, 0x00, 0x00])
  ]);

  assert.deepEqual(imageDimensionsFromBuffer(webp, "image/webp"), { width: 320, height: 240 });
});

test("imageDimensionsFromBuffer reads simple WebP VP8 keyframe dimensions", () => {
  const webp = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0x18, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP"),
    Buffer.from("VP8 "),
    Buffer.from([0x0c, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a]),
    Buffer.from([0x80, 0x02, 0x68, 0x01]),
    Buffer.from([0x00, 0x00])
  ]);

  assert.deepEqual(imageDimensionsFromBuffer(webp, "image/webp"), { width: 640, height: 360 });
});

test("imageDimensionsFromBuffer reads lossless WebP VP8L dimensions", () => {
  const webp = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0x12, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP"),
    Buffer.from("VP8L"),
    Buffer.from([0x05, 0x00, 0x00, 0x00]),
    Buffer.from([0x2f, 0xff, 0xc1, 0x3f, 0x00]),
    Buffer.from([0x00])
  ]);

  assert.deepEqual(imageDimensionsFromBuffer(webp, "image/webp"), { width: 512, height: 256 });
});

test("imageDimensionsFromBuffer returns null for unknown or malformed data", () => {
  assert.equal(imageDimensionsFromBuffer(Buffer.from("not an image")), null);
  assert.equal(imageDimensionsFromBuffer(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"), null);
  assert.equal(imageDimensionsFromBuffer(Buffer.alloc(4), "image/png"), null);
});
