import { config } from "dotenv";
config();
config({ path: "../../.env" });

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { handleAgentRun } from "./claude.js";

const app = new Hono();

app.use("/*", cors());

app.post("/api/agent", async (c) => {
  const input = await c.req.json();

  return streamSSE(c, async (stream) => {
    const emit = async (event: Record<string, unknown>) => {
      await stream.writeSSE({ data: JSON.stringify(event) });
    };
    await handleAgentRun(input, emit);
  });
});

app.get("/health", (c) => c.json({ ok: true }));

const port = Number(process.env.AGENT_PORT) || 3001;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Agent server running at http://localhost:${port}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "\n  WARNING: ANTHROPIC_API_KEY not set.\n  Create .env in the project root with your key.\n",
    );
  }
});
