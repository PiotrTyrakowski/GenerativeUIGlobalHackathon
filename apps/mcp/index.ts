import { MCPServer, text, widget } from "mcp-use/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createServer, type ServerResponse } from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = resolve(__dirname, "canvas-state.json");

// ---------------------------------------------------------------------------
// Canvas state
// ---------------------------------------------------------------------------

interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    content?: string;
    status?: string;
    metric?: string;
    source?: string;
    badges?: string[];
    actions?: string[];
  };
  style?: Record<string, unknown>;
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const canvas: { nodes: CanvasNode[]; edges: CanvasEdge[] } = { nodes: [], edges: [] };

function loadCanvasState() {
  try {
    if (existsSync(STATE_FILE)) {
      const saved = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      if (saved.nodes) canvas.nodes = saved.nodes;
      if (saved.edges) canvas.edges = saved.edges;
      console.error(`Loaded canvas state: ${canvas.nodes.length} nodes, ${canvas.edges.length} edges`);
    }
  } catch {
    console.error("Failed to load canvas state, starting fresh");
  }
}

function saveCanvasState() {
  try {
    writeFileSync(STATE_FILE, JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges }, null, 2));
  } catch {
    console.error("Failed to save canvas state");
  }
}

loadCanvasState();

const DATA_NOTICE =
  "Canvas state persisted to disk. Knowledge files under company-brain/.";

function createCompanyBrainCanvas(prompt?: string): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
} {
  const lower = prompt?.toLowerCase() ?? "";
  const showIngest =
    lower.includes("ingest") ||
    lower.includes("transcript") ||
    lower.includes("exception") ||
    lower.includes("add this");
  const showCampaign =
    lower.includes("campaign") ||
    lower.includes("outreach") ||
    lower.includes("prospect") ||
    lower.includes("npi");
  const showPolicy =
    lower.includes("refund") ||
    lower.includes("policy") ||
    lower.includes("brief");

  const nodes: CanvasNode[] = [
    {
      id: "wiki-substrate",
      type: "wiki",
      position: { x: 20, y: 260 },
      data: {
        label: "Karpathy Wiki",
        metric: "raw -> wiki -> schema",
        status: "Server-owned state",
        content:
          "Git-backed memory layer. The LLM writes wiki pages from immutable raw sources; components read the compiled state.",
        source: "company-brain/CLAUDE.md, company-brain/index.md, company-brain/log.md",
        badges: ["local files", "sample client data"],
      },
    },
    {
      id: "knowledge-brief",
      type: "brief",
      position: { x: 410, y: 40 },
      data: {
        label: showPolicy ? "Knowledge Brief: Refund Policy" : "Knowledge Brief",
        metric: showPolicy ? "3 exceptions found" : "7 sources loaded",
        status: "Search result card",
        content: showPolicy
          ? "Standard refund window is 30 days. ACME has a negotiated 45-day exception. Enterprise custom work requires approval."
          : "Ask Cursor a question and this node becomes the structured answer instead of a text wall.",
        source: "company-brain/wiki/entities + company-brain/wiki/decisions",
        badges: ["search_knowledge"],
      },
    },
    {
      id: "ingestion",
      type: "ingest",
      position: { x: 410, y: 360 },
      data: {
        label: showIngest ? "Ingestion Diff: New Input" : "Ingestion Form + Diff",
        metric: showIngest ? "+5 wiki updates" : "Paste -> diff",
        status: showIngest ? "Ready to apply" : "Idle",
        content: showIngest
          ? "New raw input would update entity, decision, pipeline, index, and log pages. This demo uses local sample Company Brain files."
          : "Paste transcript, email, policy exception, or research. The server stores raw input and returns a wiki update diff.",
        source: "company-brain/raw/transcripts, company-brain/raw/emails",
        badges: ["ingest_knowledge"],
      },
    },
    {
      id: "engagement-map",
      type: "engagement",
      position: { x: 800, y: -80 },
      data: {
        label: "Engagement Map: BuildPro",
        metric: "€20K pilot",
        status: "Proposal, 8 days stale",
        content:
          "Daniel champions. Marcus owns supply chain. Thomas confirmed impairment rules: 70% at 24mo, 100% at 12mo.",
        source: "company-brain/wiki/entities/buildpro.md",
        badges: ["stakeholders: 5", "warning"],
      },
    },
    {
      id: "hypothesis",
      type: "hypothesis",
      position: { x: 1180, y: 80 },
      data: {
        label: "Hypothesis Card: NPI Thesis",
        metric: "80% confidence",
        status: "High",
        content:
          "NPI is a structural signal problem in industrial manufacturing, not a one-off cleanup project.",
        source: "company-brain/wiki/concepts/npi-thesis.md",
        badges: ["pipes: very high", "cosmetics: low"],
      },
    },
    {
      id: "prospect-map",
      type: "prospect",
      position: { x: 1580, y: -80 },
      data: {
        label: "Prospect Map",
        metric: showCampaign ? "26 lookalikes" : "8 strong SAP targets",
        status: "Sample enrichment",
        content:
          "NordicPipe Industries, BalticFlow, Alpine Piping, and EuroPlex Systems ranked by NPI signal strength, ERP fit, and outreach angle.",
        source: "company-brain/wiki/entities/prospects.md",
        badges: ["SAP", "industrial", "signal score"],
      },
    },
    {
      id: "campaign-builder",
      type: "campaign",
      position: { x: 1580, y: 360 },
      data: {
        label: "Campaign Builder",
        metric: showCampaign ? "38 approved / 6 rejected" : "Fragments, not full emails",
        status: "Voice checks active",
        content:
          "Generates hook, pain, and CTA fragments. Flags banned phrases like 'I imagine' against the founder voice page.",
        source: "company-brain/wiki/entities/jan-novak.md",
        badges: ["voice: 94%", "banned phrases"],
      },
    },
    {
      id: "retro",
      type: "retro",
      position: { x: 1180, y: 600 },
      data: {
        label: "Retro Dashboard",
        metric: "15.4% replies",
        status: "Learning loop",
        content:
          "Early Warning angle wins. Pipes outperform cosmetics. Apply updates writes back to wiki and re-sorts the next campaign.",
        source: "company-brain/wiki/pipeline/campaign-state.md",
        badges: ["3 meetings", "1 proposal"],
      },
    },
  ];

  const edges: CanvasEdge[] = [
    { id: "edge-wiki-brief", source: "wiki-substrate", target: "knowledge-brief", label: "search" },
    { id: "edge-wiki-ingest", source: "ingestion", target: "wiki-substrate", label: "writes raw + wiki diff" },
    { id: "edge-wiki-engagement", source: "wiki-substrate", target: "engagement-map", label: "entities" },
    { id: "edge-engagement-hypothesis", source: "engagement-map", target: "hypothesis", label: "evidence" },
    { id: "edge-hypothesis-prospect", source: "hypothesis", target: "prospect-map", label: "criteria" },
    { id: "edge-prospect-campaign", source: "prospect-map", target: "campaign-builder", label: "targets" },
    { id: "edge-campaign-retro", source: "campaign-builder", target: "retro", label: "results" },
    { id: "edge-retro-hypothesis", source: "retro", target: "hypothesis", label: "learnings" },
  ];

  return { nodes, edges };
}

function loadCompanyBrain(prompt?: string): string {
  const next = createCompanyBrainCanvas(prompt);
  canvas.nodes = next.nodes;
  canvas.edges = next.edges;
  broadcast();
  return `Company Brain canvas generated. ${DATA_NOTICE}`;
}

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
  saveCanvasState();
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

const isMcpUseBuild = process.argv.some((arg) => arg.includes("build"));

if (!isMcpUseBuild) {
  sseServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Canvas SSE port ${SSE_PORT} is already in use. Set CANVAS_SSE_PORT to run another local canvas stream.`,
      );
      return;
    }
    console.error(err);
  });
  sseServer.listen(SSE_PORT, () => {
    console.error(`Canvas SSE → http://localhost:${SSE_PORT}/events`);
  });
}

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
        .enum([
          "generic",
          "note",
          "task",
          "wiki",
          "brief",
          "ingest",
          "engagement",
          "hypothesis",
          "prospect",
          "campaign",
          "retro",
        ])
        .optional()
        .describe("Node style / component type"),
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
    name: "show_company_brain",
    description:
      "Generate and render the Company Brain GTM dashboard canvas. Use this for the hackathon demo or when the user asks to see the company brain.",
    schema: z.object({
      focus: z
        .string()
        .optional()
        .describe("Optional user goal or question to bias the generated dashboard"),
    }),
    widget: {
      name: "canvas",
      invoking: "Generating Company Brain canvas…",
      invoked: "Company Brain ready",
    },
  },
  async ({ focus }) => {
    const message = loadCompanyBrain(focus);
    return widget({
      props: { nodes: canvas.nodes, edges: canvas.edges },
      output: text(message),
    });
  },
);

server.tool(
  {
    name: "company_brain_chat",
    description:
      "Cursor/Claude chat entrypoint for Company Brain. Call this after each user message that should affect or regenerate the dashboard. It updates the canvas from the message and returns the interactive widget.",
    schema: z.object({
      message: z.string().describe("The user's latest chat message"),
    }),
    widget: {
      name: "canvas",
      invoking: "Updating Company Brain from message…",
      invoked: "Company Brain updated",
    },
  },
  async ({ message }) => {
    const summary = loadCompanyBrain(message);
    return widget({
      props: { nodes: canvas.nodes, edges: canvas.edges },
      output: text(
        `${summary}\n\nInterpreted latest message: "${message}". The canvas is regenerated after this chat turn with relevant nodes emphasized through content/status changes.`,
      ),
    });
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

// --- Agent task tool (event-to-harness: Claude does the work) ---

server.tool(
  {
    name: "create_agent_task",
    description:
      "Create a task node on the canvas representing work to be done. The host AI (Claude) should then execute the instructions using canvas tools. This does NOT run an autonomous agent — it creates the task and returns instructions for the host to execute.",
    schema: z.object({
      instructions: z
        .string()
        .describe("What should be done (e.g. 'Research pipe manufacturers in DACH')"),
      position: z
        .object({ x: z.number(), y: z.number() })
        .optional()
        .describe("Where to place the task node on the canvas"),
    }),
  },
  async (input) => {
    const nodeId = `node-${randomUUID().slice(0, 8)}`;
    const label =
      input.instructions.length > 50
        ? input.instructions.slice(0, 47) + "…"
        : input.instructions;

    canvas.nodes.push({
      id: nodeId,
      type: "task",
      position: input.position || { x: canvas.nodes.length * 300, y: 100 },
      data: {
        label,
        content: input.instructions,
        status: "pending",
      },
    });
    broadcast();

    return text(
      `Task node created (${nodeId}): "${label}". Now execute these instructions by calling canvas tools (add_node, update_node, add_edge, etc.) to produce the results. Update this task node's status to "completed" when done.`,
    );
  },
);

// --- Ingestion tool ---

server.tool(
  {
    name: "ingest_knowledge",
    description:
      "Ingest raw knowledge (transcript, email, policy, research) into the canvas. Creates an ingestion node with the raw content, then the host AI should extract entities, decisions, and update relevant canvas nodes.",
    schema: z.object({
      title: z
        .string()
        .describe("Short title for the ingested content (e.g. 'Call with Thomas from BuildPro')"),
      content: z
        .string()
        .describe("The raw content to ingest (transcript text, email body, policy document, research notes)"),
      source_type: z
        .enum(["transcript", "email", "policy", "research", "other"])
        .optional()
        .describe("Type of raw input"),
      position: z
        .object({ x: z.number(), y: z.number() })
        .optional()
        .describe("Where to place the ingestion node"),
    }),
  },
  async (input) => {
    const nodeId = `node-${randomUUID().slice(0, 8)}`;
    const sourceType = input.source_type || "other";

    canvas.nodes.push({
      id: nodeId,
      type: "ingest",
      position: input.position || { x: canvas.nodes.length * 300, y: 360 },
      data: {
        label: `Ingestion: ${input.title}`,
        content: input.content.length > 200
          ? input.content.slice(0, 197) + "…"
          : input.content,
        status: "Ingested",
        metric: sourceType,
        source: `raw/${sourceType}s`,
        badges: [sourceType, `${input.content.split(/\s+/).length} words`],
        actions: ["Extract entities", "Update related nodes", "Show full text"],
      },
    });
    broadcast();

    return text(
      `Ingestion node created (${nodeId}): "${input.title}" (${sourceType}, ${input.content.split(/\s+/).length} words).\n\nFull raw content:\n${input.content}\n\nNow extract key information from this content: identify entities (people, companies, deals), decisions, action items, and signals. Create or update canvas nodes for each entity found. Connect them with edges showing relationships. Update the ingestion node's status to "Processed" when done.`,
    );
  },
);

// --- Search knowledge tool ---

server.tool(
  {
    name: "search_knowledge",
    description:
      "Search the canvas for nodes matching a query. Returns all nodes whose label, content, or badges match the search terms. Use this to find relevant context before taking action.",
    schema: z.object({
      query: z.string().describe("Search terms to match against node labels, content, and badges"),
    }),
  },
  async ({ query }) => {
    const lower = query.toLowerCase();
    const matches = canvas.nodes.filter((n) => {
      const haystack = [
        n.data.label,
        n.data.content,
        n.data.status,
        n.data.metric,
        n.data.source,
        ...(n.data.badges || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return lower.split(/\s+/).some((term) => haystack.includes(term));
    });

    if (matches.length === 0) {
      return text(`No nodes found matching "${query}". Canvas has ${canvas.nodes.length} nodes total.`);
    }

    return text(
      `Found ${matches.length} node(s) matching "${query}":\n\n${matches
        .map(
          (n) =>
            `• ${n.data.label} (${n.id}, type: ${n.type})\n  Status: ${n.data.status || "—"} · Metric: ${n.data.metric || "—"}\n  Content: ${(n.data.content || "").slice(0, 120)}`,
        )
        .join("\n\n")}`,
    );
  },
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
    if (canvas.nodes.length === 0) {
      loadCompanyBrain();
    }
    return widget({
      props: { nodes: canvas.nodes, edges: canvas.edges },
      output: text(
        `Canvas: ${canvas.nodes.length} nodes, ${canvas.edges.length} edges. ${DATA_NOTICE}`,
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
