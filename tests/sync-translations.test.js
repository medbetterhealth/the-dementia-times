import test from "node:test";
import assert from "node:assert/strict";

import { formatTranslationOutput, payloadFromTranslationOutput, validateTranslationPayload } from "../scripts/sync-translations.js";

const metadata = {
  status: "machine",
  sourceHash: "abc123",
  sourceLocale: "en",
  locale: "es",
  model: "translation-model",
  translatedAt: "2026-07-10T12:00:00.000Z"
};

test("formatTranslationOutput keeps object overlays directly readable", () => {
  assert.deepEqual(formatTranslationOutput({ title: "Título" }, metadata), {
    title: "Título",
    _translation: metadata
  });
});

test("formatTranslationOutput wraps translated arrays without converting indexes into object keys", () => {
  assert.deepEqual(formatTranslationOutput([{ id: "basics", label: "Conceptos básicos" }], metadata), {
    items: [{ id: "basics", label: "Conceptos básicos" }],
    _translation: metadata
  });
});

test("translation validation rejects truncated sections and changed protected fields", () => {
  const source = {
    slug: "example-issue",
    sections: [
      { type: "paragraph", text: "Original paragraph." },
      { type: "image", src: "/assets/example.png", alt: "Original image" }
    ]
  };

  assert.throws(
    () => validateTranslationPayload(source, { slug: "example-issue", sections: [{ type: "paragraph", text: "Texto." }] }),
    /array length/
  );
  assert.throws(
    () =>
      validateTranslationPayload(source, {
        slug: "changed-issue",
        sections: [
          { type: "paragraph", text: "Texto." },
          { type: "image", src: "/assets/example.png", alt: "Imagen" }
        ]
      }),
    /slug must not change/
  );
});

test("payloadFromTranslationOutput preserves sidecar content while dropping metadata", () => {
  assert.deepEqual(payloadFromTranslationOutput({ title: "Título", _translation: metadata }), { title: "Título" });
  assert.deepEqual(payloadFromTranslationOutput({ items: [{ id: "basics" }], _translation: metadata }), [{ id: "basics" }]);
});
