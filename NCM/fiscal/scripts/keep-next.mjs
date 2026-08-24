import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

let child = null;
let stopping = false;
let restartTimer = null;

function killTree(pid) {
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
  }
}

const port = process.argv[2] || process.env.PORT || "3000";
const host = process.env.HOST || "0.0.0.0";

function start() {
  if (stopping) return;
  console.error(`[keep-next] http://localhost:${port}  (rede: http://192.168.15.11:${port})`);
  child = spawn(
    process.execPath,
    ["--max-old-space-size=4096", nextBin, "dev", "-p", port, "-H", host],
    {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    },
  );
  child.on("exit", (code, signal) => {
    child = null;
    if (stopping) {
      process.exit(code ?? 0);
      return;
    }
    console.error(
      `\n[keep-next] o servidor saiu (code=${code ?? "?"} signal=${signal ?? "nenhum"}). Religa em 1s…`,
    );
    restartTimer = setTimeout(start, 1000);
  });
}

function requestStop() {
  if (stopping) return;
  stopping = true;
  if (restartTimer) clearTimeout(restartTimer);
  console.error("\n[keep-next] encerrando…");
  if (child?.pid) killTree(child.pid);
  else process.exit(0);
}

process.on("SIGINT", requestStop);
process.on("SIGTERM", requestStop);
if (process.platform === "win32") process.on("SIGBREAK", requestStop);

start();
