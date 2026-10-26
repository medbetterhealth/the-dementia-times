import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".webp", "image/webp"]
]);

function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const cleanPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = path.join(distDir, cleanPath);
  return requestedPath.endsWith(path.sep) ? path.join(requestedPath, "index.html") : requestedPath;
}

async function findFile(requestedPath) {
  const stat = await fs.stat(requestedPath).catch(() => null);
  if (stat?.isDirectory()) {
    return path.join(requestedPath, "index.html");
  }
  return requestedPath;
}

const server = http.createServer(async (request, response) => {
  try {
    const requestedPath = resolveRequestPath(request.url || "/");
    const filePath = await findFile(requestedPath);
    const relativePath = path.relative(distDir, filePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const contents = await fs.readFile(filePath);
    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(contents);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(500);
    response.end("Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${distDir} at http://${host}:${port}`);
});
