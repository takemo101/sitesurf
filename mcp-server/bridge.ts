import { WebSocketServer, type WebSocket } from "ws";
import { randomUUID } from "node:crypto";

export class ChromeBridge {
  private port: number;
  private client: WebSocket | null = null;
  private pending = new Map<
    string,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private wss: WebSocketServer | null = null;

  constructor(port = 7331) {
    this.port = port;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on("connection", (ws) => {
        this.client = ws;
        this.log("extension connected");

        ws.on("message", (data) => this.handleResponse(data.toString()));
        ws.on("close", () => {
          this.client = null;
          this.log("extension disconnected");
        });
      });

      this.wss.on("listening", () => {
        this.log(`listening on port ${this.port}`);
        resolve();
      });

      this.wss.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          this.wss = null;
          process.stderr.write(`Port ${this.port} in use, retrying in 1s...\n`);
          setTimeout(() => this.start().then(resolve), 1000);
        }
      });
    });
  }

  get connected(): boolean {
    return this.client?.readyState === 1;
  }

  async send(
    method: string,
    params: Record<string, unknown> = {},
    timeout = 30000,
  ): Promise<unknown> {
    if (!this.connected) {
      await this.waitForConnection(timeout);
    }

    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout: ${method}`));
      }, timeout);

      this.pending.set(id, { resolve, reject, timer });
      this.client!.send(JSON.stringify({ id, method, params }));
    });
  }

  private waitForConnection(timeout = 30000): Promise<void> {
    if (this.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error("Chrome extension not connected")),
        timeout,
      );
      const check = setInterval(() => {
        if (this.connected) {
          clearInterval(check);
          clearTimeout(deadline);
          resolve();
        }
      }, 500);
    });
  }

  private log(msg: string): void {
    process.stderr.write(`[sitesurf] ${msg}\n`);
  }

  private handleResponse(data: string): void {
    let msg: { id: string; result?: unknown; error?: string; method?: string };
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    if (msg.id === "ping" && msg.method === "ping") return;

    const req = this.pending.get(msg.id);
    if (!req) return;

    this.pending.delete(msg.id);
    clearTimeout(req.timer);

    if (msg.error) {
      req.reject(new Error(msg.error));
    } else {
      req.resolve(msg.result);
    }
  }
}
