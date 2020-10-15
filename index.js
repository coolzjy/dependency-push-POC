const http2 = require("http2");
const fs = require("fs");
const path = require("path");
const mime = require("mime");
const resolvePathname = require("resolve-pathname")
const resolvePath = require("resolve-path");
const { isFileAccessible, readFile, parseImports } = require("./utils");

const ROOT_PATH = path.resolve(__dirname, "public");

const server = http2.createSecureServer({
  key: fs.readFileSync("./key.pem"),
  cert: fs.readFileSync("./server.crt"),
});

async function pushImports(imports, stream, basePath) {
  const importObjs = imports.map((i) => ({ path: i, base: basePath }));

  let current;

  while ((current = importObjs.shift())) {
    const targetPath = resolvePathname(current.path, current.base);
    const assetPath = resolvePath(ROOT_PATH, targetPath.replace(/^\//, ""));
    const code = await readFile(assetPath);
    const imports = await parseImports(code);

    // TODO: 处理循环依赖
    importObjs.push(...imports.map((i) => ({ path: i, base: targetPath })));
    stream.pushStream({ ":path": targetPath }, (error, pushStream) => {
      pushStream.respond({
        "content-type": mime.getType(assetPath),
      });
      pushStream.end(code);
    });
  }
}

server.on("stream", async (stream, headers) => {
  const [pathname, query] = headers[":path"].split("?");

  const targetPath = resolvePathname(decodeURIComponent(pathname));
  const assetPath = resolvePath(ROOT_PATH, targetPath.replace(/^\//, ""));

  if (!(await isFileAccessible(assetPath))) {
    stream.respond({ ":status": 404 });
    stream.close();
    return;
  }

  if (targetPath.endsWith(".js") && query === "push") {
    const code = await readFile(assetPath);
    const imports = await parseImports(code);

    await pushImports(imports, stream, targetPath);
  }

  stream.respondWithFile(assetPath, {
    "content-type": mime.getType(assetPath),
  });
});

server.listen(8080);
