const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const webRoot = __dirname;
const dataDir = path.join(root, "data");
const reportsDir = path.join(root, "reports");
const port = Number(process.env.PORT || 3000);
const sitePassword = process.env.NANA_NEWS_PASSWORD || "Nanaonlinenews";
const cookieName = "nana_news_session";
const cookieValue = crypto.createHash("sha256").update(`nana-news:${sitePassword}`).digest("hex");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), "application/json; charset=utf-8");
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function isAuthed(req) {
  return parseCookies(req)[cookieName] === cookieValue;
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
  });
}

async function login(req, res) {
  const body = await readBody(req);
  let password = "";
  try {
    password = JSON.parse(body).password || "";
  } catch {
    password = "";
  }
  if (password !== sitePassword) {
    sendJson(res, 401, { ok: false, error: "密码不正确" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie": `${cookieName}=${encodeURIComponent(cookieValue)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`,
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify({ ok: true }));
}

function readLatest() {
  const latestPath = path.join(dataDir, "latest.json");
  if (!fs.existsSync(latestPath)) {
    return { count: 0, items: [], markdown: "", html: "" };
  }
  return JSON.parse(fs.readFileSync(latestPath, "utf8"));
}

function listReports() {
  if (!fs.existsSync(reportsDir)) return [];
  return fs
    .readdirSync(reportsDir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .reverse()
    .map((name) => ({
      name,
      date: (name.match(/\d{4}-\d{2}-\d{2}/) || [""])[0],
      markdown: `/reports/${name}`,
      html: `/reports/${name.replace(/\.md$/, ".html")}`,
    }));
}

function regenerate(res) {
  const child = spawn("python", ["src\\run_daily.py", "--dry-run"], {
    cwd: root,
    shell: true,
    env: process.env,
  });
  let output = "";
  let error = "";
  child.stdout.on("data", (chunk) => (output += chunk.toString()));
  child.stderr.on("data", (chunk) => (error += chunk.toString()));
  child.on("close", (code) => {
    if (code !== 0) {
      sendJson(res, 500, { ok: false, error: error || output || `Exited with ${code}` });
      return;
    }
    sendJson(res, 200, { ok: true, output, latest: readLatest() });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  if (url.pathname === "/api/login" && req.method === "POST") {
    login(req, res);
    return;
  }

  const publicPaths = new Set(["/login.html", "/styles.css"]);
  if (!isAuthed(req) && !publicPaths.has(url.pathname)) {
    if (url.pathname.startsWith("/api/")) {
      sendJson(res, 401, { ok: false, error: "需要登录" });
      return;
    }
    res.writeHead(302, { Location: "/login.html" });
    res.end();
    return;
  }

  if (url.pathname === "/api/latest") {
    sendJson(res, 200, readLatest());
    return;
  }

  if (url.pathname === "/api/reports") {
    sendJson(res, 200, listReports());
    return;
  }

  if (url.pathname === "/api/regenerate" && req.method === "POST") {
    regenerate(res);
    return;
  }

  if (url.pathname.startsWith("/reports/")) {
    const file = path.join(reportsDir, path.basename(url.pathname));
    if (!fs.existsSync(file)) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    send(res, 200, fs.readFileSync(file), types[path.extname(file)] || "text/plain; charset=utf-8");
    return;
  }

  const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.normalize(path.join(webRoot, safePath));
  if (!file.startsWith(webRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }
  send(res, 200, fs.readFileSync(file), types[path.extname(file)] || "text/plain; charset=utf-8");
});

server.listen(port, () => {
  console.log(`Daily news dashboard running at http://localhost:${port}`);
});
