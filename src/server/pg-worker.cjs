const { parentPort } = require("node:worker_threads");
const pg = require("pg");

pg.types.setTypeParser(20, (value) => Number(value));
pg.types.setTypeParser(21, (value) => Number(value));
pg.types.setTypeParser(23, (value) => Number(value));
pg.types.setTypeParser(1700, (value) => Number(value));

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

function scrub(error) {
  const message = error instanceof Error ? error.message : "pg_query_failed";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://redacted");
}

client
  .connect()
  .then(() => {
    parentPort.on("message", async (msg) => {
      if (!msg || msg.op === "end") {
        await client.end().catch(() => undefined);
        return;
      }
      try {
        if (msg.op === "exec") {
          await client.query(msg.text);
          msg.port.postMessage({ ok: true, rows: [], rowCount: 0 });
        } else {
          const res = await client.query(msg.text, msg.params ?? []);
          msg.port.postMessage({ rows: res.rows, rowCount: res.rowCount ?? 0 });
        }
      } catch (error) {
        msg.port.postMessage({ error: scrub(error) });
      } finally {
        const flag = new Int32Array(msg.shared);
        Atomics.store(flag, 0, 1);
        Atomics.notify(flag, 0);
      }
    });
  })
  .catch((error) => {
    parentPort.postMessage({ bootError: scrub(error) });
  });
