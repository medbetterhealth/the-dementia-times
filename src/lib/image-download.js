import fs from "node:fs/promises";
import path from "node:path";
import { imageDimensionsFromBuffer } from "./image-metadata.js";

const supportedContentTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"]
]);
const issueSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizedContentType(contentType) {
  return String(contentType).split(";")[0].trim().toLowerCase();
}

function assertValidIssueSlug(slug) {
  if (!issueSlugPattern.test(slug)) {
    throw new Error(`Invalid issue slug: ${slug}`);
  }
}

function publicIssueImagePath(slug, index, extension) {
  assertValidIssueSlug(slug);
  const filename = index === 0 ? `cover${extension}` : `image-${index}${extension}`;
  return `/assets/issues/${slug}/${filename}`;
}

export function imageExtensionFromContentType(contentType) {
  const extension = supportedContentTypes.get(normalizedContentType(contentType));
  if (!extension) {
    throw new Error(`Unsupported image content type: ${contentType}`);
  }
  return extension;
}

export function localIssueImagePath(slug, index, extension) {
  assertValidIssueSlug(slug);
  return path.join("public", "assets", "issues", slug, index === 0 ? `cover${extension}` : `image-${index}${extension}`);
}

export function remoteImageToLocalMetadata(slug, index, extension, alt, dimensions = null) {
  const metadata = {
    src: publicIssueImagePath(slug, index, extension),
    alt
  };
  if (dimensions) {
    metadata.width = dimensions.width;
    metadata.height = dimensions.height;
  }
  return metadata;
}

export async function downloadIssueImages({ rootDir, slug, remoteImages, fetchImpl = fetch }) {
  assertValidIssueSlug(slug);
  const images = [];
  let coverImage = "";

  for (const [index, remoteImage] of remoteImages.entries()) {
    const response = await fetchImpl(remoteImage.src);

    if (!response.ok) {
      throw new Error(`Failed to download image ${remoteImage.src}: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const extension = imageExtensionFromContentType(contentType);
    const relativePath = localIssueImagePath(slug, index, extension);
    const filePath = path.join(rootDir, relativePath);
    const body = Buffer.from(await response.arrayBuffer());
    const metadata = remoteImageToLocalMetadata(
      slug,
      index,
      extension,
      remoteImage.alt,
      imageDimensionsFromBuffer(body, contentType)
    );

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);

    if (index === 0) {
      coverImage = metadata.src;
    } else {
      images.push(metadata);
    }
  }

  return { coverImage, images };
}
