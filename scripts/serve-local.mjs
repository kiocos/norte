import { createServer } from "node:http";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import handler from "serve-handler";

const directory = resolve("out");
await access(`${directory}/index.html`);
const port = Number(process.env.PORT || 3000);
const server = createServer((request, response) => {
  handler(request, response, {
    public: directory,
    cleanUrls: true,
    trailingSlash: true,
    directoryListing: false,
  }).catch((error) => {
    console.error("Static file error:", error.message);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Norte estático: http://127.0.0.1:${port}`);
});
