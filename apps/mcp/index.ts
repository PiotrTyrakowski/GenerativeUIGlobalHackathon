import { MCPServer, text, widget } from "mcp-use/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createServer, type ServerResponse } from "http";

// ---------------------------------------------------------------------------
// Canvas state
// ---------------------------------------------------------------------------

interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; content?: string };
  style?: Record<string, unknown>;
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const canvas: { nodes: CanvasNode[]; edges: CanvasEdge[] } = {
  nodes: [],
  edges: [],
};

// ---------------------------------------------------------------------------
// SSE broadcast (for standalone web app at apps/web)
// ---------------------------------------------------------------------------

const sseClients = new Set<ServerResponse>();

function broadcast() {
  const payload = JSON.stringify({
    type: "STATE_SNAPSHOT",
    snapshot: { nodes: canvas.nodes, edges: canvas.edges },
  });
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
}

const SSE_PORT = Number(process.env.CANVAS_SSE_PORT) || 3002;

const sseServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(
      `data: ${JSON.stringify({ type: "STATE_SNAPSHOT", snapshot: { nodes: canvas.nodes, edges: canvas.edges } })}\n\n`,
    );
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (req.url === "/state" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges }));
    return;
  }

  if (req.url === "/state" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => {
      try {
        const update = JSON.parse(body);
        if (update.nodes) canvas.nodes = update.nodes;
        if (update.edges) canvas.edges = update.edges;
        broadcast();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

sseServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`SSE port ${SSE_PORT} in use, trying ${SSE_PORT + 1}`);
    sseServer.listen(SSE_PORT + 1);
  }
});
sseServer.listen(SSE_PORT, () => {
  console.error(`Canvas SSE → http://localhost:${SSE_PORT}/events`);
});

// ---------------------------------------------------------------------------
// Canvas tool helpers
// ---------------------------------------------------------------------------

function addNode(args: {
  label: string;
  content?: string;
  position?: { x: number; y: number };
  type?: string;
}): { nodeId: string; message: string } {
  const id = `node-${randomUUID().slice(0, 8)}`;
  canvas.nodes.push({
    id,
    type: args.type || "generic",
    position: args.position || { x: canvas.nodes.length * 300, y: 100 },
    data: { label: args.label, content: args.content },
  });
  broadcast();
  return { nodeId: id, message: `Created "${args.label}" (${id})` };
}

function updateNode(args: {
  id: string;
  label?: string;
  content?: string;
}): string {
  const node = canvas.nodes.find((n) => n.id === args.id);
  if (!node) return `Node "${args.id}" not found`;
  if (args.label) node.data.label = args.label;
  if (args.content !== undefined) node.data.content = args.content;
  broadcast();
  return `Updated "${args.id}"`;
}

function removeNode(id: string): string {
  const idx = canvas.nodes.findIndex((n) => n.id === id);
  if (idx === -1) return `Node "${id}" not found`;
  canvas.nodes.splice(idx, 1);
  canvas.edges = canvas.edges.filter(
    (e) => e.source !== id && e.target !== id,
  );
  broadcast();
  return `Removed "${id}" and its edges`;
}

function addEdge(args: {
  source: string;
  target: string;
  label?: string;
}): string {
  if (!canvas.nodes.some((n) => n.id === args.source))
    return `Source "${args.source}" not found`;
  if (!canvas.nodes.some((n) => n.id === args.target))
    return `Target "${args.target}" not found`;
  const id = `edge-${randomUUID().slice(0, 8)}`;
  canvas.edges.push({
    id,
    source: args.source,
    target: args.target,
    label: args.label,
  });
  broadcast();
  return `Connected "${args.source}" → "${args.target}" (${id})`;
}

function removeEdge(id: string): string {
  const idx = canvas.edges.findIndex((e) => e.id === id);
  if (idx === -1) return `Edge "${id}" not found`;
  canvas.edges.splice(idx, 1);
  broadcast();
  return `Removed edge "${id}"`;
}

function moveNode(id: string, pos: { x: number; y: number }): string {
  const node = canvas.nodes.find((n) => n.id === id);
  if (!node) return `Node "${id}" not found`;
  node.position = pos;
  broadcast();
  return `Moved "${id}" to (${pos.x}, ${pos.y})`;
}

// ---------------------------------------------------------------------------
// MCP Server (mcp-use)
// ---------------------------------------------------------------------------

const server = new MCPServer({
  name: "canvas",
  title: "Infinite Canvas",
  version: "1.0.0",
  description:
    "An interactive infinite canvas that renders inline. Use add_node / add_edge to build, then show_canvas to render the visual.",
  baseUrl: process.env.MCP_URL || "http://localhost:3011",
});

// --- Mutation tools (return text, no widget) ---

server.tool(
  {
    name: "add_node",
    description:
      "Add a new node to the canvas. Space nodes 250–300 px apart. Returns the new node ID.",
    schema: z.object({
      label: z.string().describe("Display title"),
      content: z.string().optional().describe("Body text inside the node"),
      position: z
        .object({ x: z.number(), y: z.number() })
        .optional()
        .describe("Canvas position {x, y}"),
      type: z
        .enum(["generic", "note", "task"])
        .optional()
        .describe("Node style: generic (blue), note (amber), task (green)"),
    }),
  },
  async (input) => {
    const result = addNode(input);
    return text(JSON.stringify(result));
  },
);

server.tool(
  {
    name: "update_node",
    description: "Update an existing node's label or content.",
    schema: z.object({
      id: z.string().describe("Node ID"),
      label: z.string().optional(),
      content: z.string().optional(),
    }),
  },
  async (input) => text(updateNode(input)),
);

server.tool(
  {
    name: "remove_node",
    description: "Remove a node and all its connected edges.",
    schema: z.object({ id: z.string().describe("Node ID") }),
  },
  async ({ id }) => text(removeNode(id)),
);

server.tool(
  {
    name: "add_edge",
    description: "Connect two nodes with a directed edge.",
    schema: z.object({
      source: z.string().describe("Source node ID"),
      target: z.string().describe("Target node ID"),
      label: z.string().optional().describe("Edge label"),
    }),
  },
  async (input) => text(addEdge(input)),
);

server.tool(
  {
    name: "remove_edge",
    description: "Remove an edge.",
    schema: z.object({ id: z.string().describe("Edge ID") }),
  },
  async ({ id }) => text(removeEdge(id)),
);

server.tool(
  {
    name: "move_node",
    description: "Move a node to a new position.",
    schema: z.object({
      id: z.string().describe("Node ID"),
      position: z.object({ x: z.number(), y: z.number() }),
    }),
  },
  async ({ id, position }) => text(moveNode(id, position)),
);

server.tool(
  {
    name: "clear_canvas",
    description: "Remove all nodes and edges.",
    schema: z.object({}),
  },
  async () => {
    canvas.nodes = [];
    canvas.edges = [];
    broadcast();
    return text("Canvas cleared");
  },
);

server.tool(
  {
    name: "get_canvas_state",
    description:
      "Return the current canvas state as JSON (all node IDs, positions, edges).",
    schema: z.object({}),
  },
  async () => text(JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges }, null, 2)),
);

// --- Display tool (renders the inline widget) ---

server.tool(
  {
    name: "show_canvas",
    description:
      "Render the interactive canvas inline. Call this after adding/modifying nodes to show the visual result.",
    schema: z.object({}),
    widget: {
      name: "canvas",
      invoking: "Rendering canvas…",
      invoked: "Canvas ready",
    },
  },
  async () => {
    return widget({
      props: { nodes: canvas.nodes, edges: canvas.edges },
      output: text(
        canvas.nodes.length === 0
          ? "Canvas is empty."
          : `Canvas: ${canvas.nodes.length} nodes, ${canvas.edges.length} edges.`,
      ),
    });
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen().then(() => {
  console.error("Canvas MCP App running");
});
