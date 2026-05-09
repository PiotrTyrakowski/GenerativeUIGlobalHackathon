import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createServer, type ServerResponse } from "http";
import { randomUUID } from "crypto";

// --- Canvas State ---

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

// --- SSE Broadcasting ---

const sseClients = new Set<ServerResponse>();

function broadcast() {
  const data = JSON.stringify({
    type: "STATE_SNAPSHOT",
    snapshot: { nodes: canvas.nodes, edges: canvas.edges },
  });
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

// --- HTTP Server (SSE + state sync) ---

const SSE_PORT = Number(process.env.CANVAS_SSE_PORT) || 3002;

const httpServer = createServer((req, res) => {
  // CORS
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

    // Send current state immediately
    const snapshot = JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: { nodes: canvas.nodes, edges: canvas.edges },
    });
    res.write(`data: ${snapshot}\n\n`);

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
    req.on("data", (chunk) => (body += chunk));
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

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${SSE_PORT} in use, trying ${SSE_PORT + 1}...`);
    httpServer.listen(SSE_PORT + 1, () => {
      console.error(`Canvas SSE server on http://localhost:${SSE_PORT + 1}/events`);
    });
  } else {
    console.error("HTTP server error:", err);
  }
});

httpServer.listen(SSE_PORT, () => {
  console.error(`Canvas SSE server on http://localhost:${SSE_PORT}/events`);
});

// --- Tool Helpers ---

function addNode(args: {
  label: string;
  content?: string;
  position?: { x: number; y: number };
  type?: string;
  style?: Record<string, unknown>;
}): { nodeId: string; message: string } {
  const id = `node-${randomUUID().slice(0, 8)}`;
  canvas.nodes.push({
    id,
    type: args.type || "generic",
    position: args.position || { x: canvas.nodes.length * 300, y: 100 },
    data: { label: args.label, content: args.content },
    style: args.style,
  });
  broadcast();
  return { nodeId: id, message: `Created "${args.label}" (${id})` };
}

function updateNode(args: {
  id: string;
  label?: string;
  content?: string;
  style?: Record<string, unknown>;
}): string {
  const node = canvas.nodes.find((n) => n.id === args.id);
  if (!node) return `Node "${args.id}" not found`;
  if (args.label) node.data.label = args.label;
  if (args.content !== undefined) node.data.content = args.content;
  if (args.style) node.style = { ...node.style, ...args.style };
  broadcast();
  return `Updated "${args.id}"`;
}

function removeNode(id: string): string {
  const idx = canvas.nodes.findIndex((n) => n.id === id);
  if (idx === -1) return `Node "${id}" not found`;
  canvas.nodes.splice(idx, 1);
  canvas.edges = canvas.edges.filter((e) => e.source !== id && e.target !== id);
  broadcast();
  return `Removed "${id}" and its edges`;
}

function addEdge(args: {
  source: string;
  target: string;
  label?: string;
}): { edgeId: string; message: string } | string {
  if (!canvas.nodes.some((n) => n.id === args.source))
    return `Source "${args.source}" not found`;
  if (!canvas.nodes.some((n) => n.id === args.target))
    return `Target "${args.target}" not found`;
  const id = `edge-${randomUUID().slice(0, 8)}`;
  canvas.edges.push({ id, source: args.source, target: args.target, label: args.label });
  broadcast();
  return { edgeId: id, message: `Connected "${args.source}" → "${args.target}"` };
}

function removeEdge(id: string): string {
  const idx = canvas.edges.findIndex((e) => e.id === id);
  if (idx === -1) return `Edge "${id}" not found`;
  canvas.edges.splice(idx, 1);
  broadcast();
  return `Removed edge "${id}"`;
}

function moveNode(id: string, position: { x: number; y: number }): string {
  const node = canvas.nodes.find((n) => n.id === id);
  if (!node) return `Node "${id}" not found`;
  node.position = position;
  broadcast();
  return `Moved "${id}" to (${position.x}, ${position.y})`;
}

// --- MCP Server ---

const mcp = new McpServer({
  name: "canvas",
  version: "1.0.0",
});

mcp.tool(
  "add_node",
  "Add a new node to the infinite canvas",
  {
    label: z.string().describe("Display title for the node"),
    content: z.string().optional().describe("Body text inside the node"),
    position: z
      .object({ x: z.number(), y: z.number() })
      .optional()
      .describe("Canvas position. Space nodes 250-300px apart."),
    type: z
      .enum(["generic", "note", "task"])
      .optional()
      .describe("Node type: generic, note, or task"),
  },
  async (args) => {
    const result = addNode(args);
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  },
);

mcp.tool(
  "update_node",
  "Update an existing node's label, content, or style",
  {
    id: z.string().describe("Node ID to update"),
    label: z.string().optional(),
    content: z.string().optional(),
  },
  async (args) => {
    const result = updateNode(args);
    return { content: [{ type: "text" as const, text: result }] };
  },
);

mcp.tool(
  "remove_node",
  "Remove a node and its connected edges",
  { id: z.string().describe("Node ID to remove") },
  async (args) => {
    const result = removeNode(args.id);
    return { content: [{ type: "text" as const, text: result }] };
  },
);

mcp.tool(
  "add_edge",
  "Connect two nodes with a directed edge",
  {
    source: z.string().describe("Source node ID"),
    target: z.string().describe("Target node ID"),
    label: z.string().optional().describe("Edge label"),
  },
  async (args) => {
    const result = addEdge(args);
    const text = typeof result === "string" ? result : JSON.stringify(result);
    return { content: [{ type: "text" as const, text }] };
  },
);

mcp.tool(
  "remove_edge",
  "Remove an edge between nodes",
  { id: z.string().describe("Edge ID to remove") },
  async (args) => {
    const result = removeEdge(args.id);
    return { content: [{ type: "text" as const, text: result }] };
  },
);

mcp.tool(
  "move_node",
  "Move a node to a new position",
  {
    id: z.string().describe("Node ID to move"),
    position: z.object({ x: z.number(), y: z.number() }),
  },
  async (args) => {
    const result = moveNode(args.id, args.position);
    return { content: [{ type: "text" as const, text: result }] };
  },
);

mcp.tool(
  "get_canvas_state",
  "Get the current canvas state (all nodes and edges)",
  {},
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { nodes: canvas.nodes, edges: canvas.edges },
            null,
            2,
          ),
        },
      ],
    };
  },
);

mcp.tool(
  "clear_canvas",
  "Remove all nodes and edges",
  {},
  async () => {
    canvas.nodes = [];
    canvas.edges = [];
    broadcast();
    return { content: [{ type: "text" as const, text: "Canvas cleared" }] };
  },
);

// --- Start ---

const transport = new StdioServerTransport();
await mcp.connect(transport);
console.error("Canvas MCP server running");
