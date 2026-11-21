import fs from "node:fs";
import path from "node:path";
import { MessageChannel, Worker, receiveMessageOnPort } from "node:worker_threads";
import type { Database } from "better-sqlite3";

type PgResult = { rows: unknown[]; rowCount: number; error?: string };

function workerFile(): string {
  const candidates = [
    path.join(process.cwd(), "src", "server", "pg-worker.cjs"),
    path.join(process.cwd(), "pg-worker.cjs"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("pg_worker_missing");
}

function translate(sql: string): string {
  let text = sql.replace(/\bBEGIN IMMEDIATE\b/gi, "BEGIN");
  const ignore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(text);
  if (ignore) text = text.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i, "INSERT INTO ");
  let index = 0;
  text = text.replace(/\?/g, () => `$${++index}`);
  if (ignore && !/ON CONFLICT/i.test(text)) text += " ON CONFLICT DO NOTHING";
  return text;
}

export function openPg(connectionString: string): Database {
  const worker = new Worker(workerFile(), {
    env: { ...process.env, DATABASE_URL: connectionString },
  });
  const state = { inTransaction: false, bootError: "" };
  worker.on("message", (msg: { bootError?: string }) => {
    if (msg?.bootError) state.bootError = msg.bootError;
  });

  function call(op: "query" | "exec", text: string, params: unknown[]): PgResult {
    if (state.bootError) throw new Error(state.bootError);
    const shared = new SharedArrayBuffer(4);
    const flag = new Int32Array(shared);
    const { port1, port2 } = new MessageChannel();
    Atomics.store(flag, 0, 0);
    worker.postMessage({ op, text, params, shared, port: port2 }, [port2]);
    const waited = Atomics.wait(flag, 0, 0, 60_000);
    if (waited === "timed-out") throw new Error("pg_timeout");
    let received = receiveMessageOnPort(port1);
    if (!received) {
      const start = Date.now();
      while (!received && Date.now() - start < 1000) received = receiveMessageOnPort(port1);
    }
    if (!received) throw new Error("pg_empty");
    const message = received.message as PgResult;
    if (message.error) throw new Error(message.error);
    return message;
  }

  const db = {
    get inTransaction() {
      return state.inTransaction;
    },
    prepare(sql: string) {
      const text = translate(sql);
      return {
        get: (...params: unknown[]) => call("query", text, params).rows[0],
        all: (...params: unknown[]) => call("query", text, params).rows,
        run: (...params: unknown[]) => {
          const result = call("query", text, params);
          return { changes: result.rowCount, lastInsertRowid: 0 };
        },
      };
    },
    exec(sql: string) {
      const text = translate(sql);
      call("exec", text, []);
      if (/^\s*BEGIN\b/i.test(text)) state.inTransaction = true;
      if (/^\s*(COMMIT|ROLLBACK)\b/i.test(text)) state.inTransaction = false;
    },
    close() {
      worker.postMessage({ op: "end" });
      void worker.terminate();
    },
    pragma() {
      return [];
    },
  };
  return db as unknown as Database;
}
