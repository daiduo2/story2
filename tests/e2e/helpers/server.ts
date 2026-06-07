import { spawn, ChildProcess } from "child_process";

export const SERVER_PORT = 3724;

let sharedProc: ChildProcess | null = null;

export async function startServer(): Promise<ChildProcess> {
  // If a shared server is already running, reuse it
  if (sharedProc && !sharedProc.killed) {
    return sharedProc;
  }

  // Check if another server is already listening on the port
  const alreadyRunning = await isServerRunning(
    `http://localhost:${SERVER_PORT}`,
    2000
  );
  if (alreadyRunning) {
    // Return a stub that stopServer can identify and skip
    return { killed: false, pid: undefined } as unknown as ChildProcess;
  }

  // Try to start server directly, bypassing make to avoid build delays
  const proc = spawn("node", ["dist/agent/server.js"], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: { ...process.env, NARRATIVE_PORT: String(SERVER_PORT) },
  });

  sharedProc = proc;

  // Wait for server to be ready
  await waitForServer(`http://localhost:${SERVER_PORT}`, 15000);
  return proc;
}

export async function stopServer(proc: ChildProcess): Promise<void> {
  // If this is a stub (no pid), just clear shared state
  if (!proc.pid) {
    sharedProc = null;
    return;
  }

  // If the shared proc was replaced by another test, don't stop it
  if (sharedProc && sharedProc !== proc) {
    return;
  }

  if (!proc.killed) {
    return new Promise((resolve) => {
      proc.on("close", resolve);
      proc.kill("SIGTERM");

      // Force kill after 3s
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill("SIGKILL");
        }
        resolve();
      }, 3000);
    });
  }

  sharedProc = null;
}

async function isServerRunning(url: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (res.status === 200) return true;
    } catch {
      // not ready
    }
    await sleep(200);
  }
  return false;
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200) return;
    } catch {
      // Server not ready yet
    }
    await sleep(500);
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
