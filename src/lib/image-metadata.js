function hasAscii(buffer, offset, value) {
  return buffer.length >= offset + value.length && buffer.toString("ascii", offset, offset + value.length) === value;
}

function positiveDimensions(width, height) {
  if (Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0) {
    return { width, height };
  }
  return null;
}

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function pngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 ||
    !hasAscii(buffer, 1, "PNG\r\n\u001a\n") ||
    buffer.readUInt32BE(8) !== 13 ||
    !hasAscii(buffer, 12, "IHDR")
  ) {
    return null;
  }

  return positiveDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
}

function gifDimensions(buffer) {
  if (buffer.length < 10 || (!hasAscii(buffer, 0, "GIF87a") && !hasAscii(buffer, 0, "GIF89a"))) {
    return null;
  }

  return positiveDimensions(buffer.readUInt16LE(6), buffer.readUInt16LE(8));
}

function isSofMarker(marker) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function isStandaloneJpegMarker(marker) {
  return marker === 0x01 || marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7);
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      return null;
    }

    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buffer.length) return null;

    const marker = buffer[offset];
    offset += 1;

    if (isStandaloneJpegMarker(marker)) {
      continue;
    }

    if (offset + 2 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2) return null;

    const segmentStart = offset + 2;
    const segmentEnd = offset + segmentLength;
    if (segmentEnd > buffer.length) return null;

    if (isSofMarker(marker)) {
      if (segmentLength < 7) return null;
      return positiveDimensions(buffer.readUInt16BE(segmentStart + 3), buffer.readUInt16BE(segmentStart + 1));
    }

    if (marker === 0xda) {
      return null;
    }

    offset = segmentEnd;
  }

  return null;
}

function vp8xDimensions(buffer, offset, chunkSize) {
  if (chunkSize < 10 || offset + 10 > buffer.length) return null;

  const width = readUint24LE(buffer, offset + 4) + 1;
  const height = readUint24LE(buffer, offset + 7) + 1;
  return positiveDimensions(width, height);
}

function vp8Dimensions(buffer, offset, chunkSize) {
  if (
    chunkSize < 10 ||
    offset + 10 > buffer.length ||
    (buffer[offset] & 0x01) !== 0 ||
    buffer[offset + 3] !== 0x9d ||
    buffer[offset + 4] !== 0x01 ||
    buffer[offset + 5] !== 0x2a
  ) {
    return null;
  }

  const width = buffer.readUInt16LE(offset + 6) & 0x3fff;
  const height = buffer.readUInt16LE(offset + 8) & 0x3fff;
  return positiveDimensions(width, height);
}

function vp8lDimensions(buffer, offset, chunkSize) {
  if (chunkSize < 5 || offset + 5 > buffer.length || buffer[offset] !== 0x2f) {
    return null;
  }

  const bits = buffer.readUInt32LE(offset + 1);
  const width = (bits & 0x3fff) + 1;
  const height = ((bits >> 14) & 0x3fff) + 1;
  return positiveDimensions(width, height);
}

function webpDimensions(buffer) {
  if (buffer.length < 20 || !hasAscii(buffer, 0, "RIFF") || !hasAscii(buffer, 8, "WEBP")) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > buffer.length) return null;

    if (chunkType === "VP8X") {
      return vp8xDimensions(buffer, chunkStart, chunkSize);
    }
    if (chunkType === "VP8 ") {
      return vp8Dimensions(buffer, chunkStart, chunkSize);
    }
    if (chunkType === "VP8L") {
      return vp8lDimensions(buffer, chunkStart, chunkSize);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  return null;
}

export function imageDimensionsFromBuffer(buffer, contentType = "") {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }

  const type = String(contentType).split(";")[0].trim().toLowerCase();

  if (type === "image/png" || buffer[0] === 0x89) return pngDimensions(buffer);
  if (type === "image/gif" || hasAscii(buffer, 0, "GIF")) return gifDimensions(buffer);
  if (type === "image/jpeg" || type === "image/jpg" || (buffer[0] === 0xff && buffer[1] === 0xd8)) {
    return jpegDimensions(buffer);
  }
  if (type === "image/webp" || hasAscii(buffer, 0, "RIFF")) return webpDimensions(buffer);

  return null;
}
