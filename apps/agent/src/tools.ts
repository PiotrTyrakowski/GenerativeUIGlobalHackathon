import { randomUUID } from "crypto";

export interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    content?: string;
    [key: string]: unknown;
  };
  style?: Record<string, unknown>;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export const canvasTools = [
  {
    name: "add_node",
    description:
      "Add a new node to the infinite canvas. Use this to create visual elements like cards, notes, or tasks.",
    input_schema: {
      type: "object" as const,
      properties: {
        label: { type: "string", description: "Display title for the node" },
        content: {
          type: "string",
          description: "Body text displayed inside the node",
        },
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
          description:
            "Position on the canvas. Space nodes 250-300px apart for readability.",
        },
        type: {
          type: "string",
          enum: ["generic", "note", "task"],
          description:
            "'generic' for general content, 'note' for text notes, 'task' for actionable items",
        },
        style: {
          type: "object",
          properties: {
            backgroundColor: { type: "string" },
            borderColor: { type: "string" },
            color: { type: "string" },
          },
          description: "Optional CSS-like style overrides",
        },
      },
      required: ["label"],
    },
  },
  {
    name: "update_node",
    description: "Update an existing node's label, content, or style.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ID of the node to update" },
        label: { type: "string" },
        content: { type: "string" },
        style: { type: "object" },
      },
      required: ["id"],
    },
  },
  {
    name: "remove_node",
    description:
      "Remove a node and all its connected edges from the canvas.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ID of the node to remove" },
      },
      required: ["id"],
    },
  },
  {
    name: "add_edge",
    description: "Connect two nodes with a directed edge.",
    input_schema: {
      type: "object" as const,
      properties: {
        source: { type: "string", description: "ID of the source node" },
        target: { type: "string", description: "ID of the target node" },
        label: { type: "string", description: "Optional label for the edge" },
      },
      required: ["source", "target"],
    },
  },
  {
    name: "remove_edge",
    description: "Remove an edge from the canvas.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ID of the edge to remove" },
      },
      required: ["id"],
    },
  },
  {
    name: "move_node",
    description: "Move a node to a new position on the canvas.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ID of the node to move" },
        position: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" } },
          required: ["x", "y"],
        },
      },
      required: ["id", "position"],
    },
  },
  {
    name: "clear_canvas",
    description: "Remove all nodes and edges from the canvas.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

export function executeCanvasTool(
  name: string,
  input: Record<string, unknown>,
  state: CanvasState,
): { success: boolean; message: string; [key: string]: unknown } {
  switch (name) {
    case "add_node": {
      const id = `node-${randomUUID().slice(0, 8)}`;
      const node: CanvasNode = {
        id,
        type: (input.type as string) || "generic",
        position: (input.position as { x: number; y: number }) || {
          x: state.nodes.length * 300,
          y: 100,
        },
        data: {
          label: input.label as string,
          content: (input.content as string) || "",
        },
        style: input.style as Record<string, unknown> | undefined,
      };
      state.nodes.push(node);
      return { success: true, message: `Created node "${input.label}" (id: ${id})`, nodeId: id };
    }

    case "update_node": {
      const node = state.nodes.find((n) => n.id === input.id);
      if (!node) return { success: false, message: `Node "${input.id}" not found` };
      if (input.label) node.data.label = input.label as string;
      if (input.content !== undefined) node.data.content = input.content as string;
      if (input.style) node.style = { ...node.style, ...(input.style as Record<string, unknown>) };
      return { success: true, message: `Updated node "${input.id}"` };
    }

    case "remove_node": {
      const idx = state.nodes.findIndex((n) => n.id === input.id);
      if (idx === -1) return { success: false, message: `Node "${input.id}" not found` };
      state.nodes.splice(idx, 1);
      state.edges = state.edges.filter((e) => e.source !== input.id && e.target !== input.id);
      return { success: true, message: `Removed node "${input.id}" and its edges` };
    }

    case "add_edge": {
      const id = `edge-${randomUUID().slice(0, 8)}`;
      if (!state.nodes.some((n) => n.id === input.source))
        return { success: false, message: `Source node "${input.source}" not found` };
      if (!state.nodes.some((n) => n.id === input.target))
        return { success: false, message: `Target node "${input.target}" not found` };
      state.edges.push({
        id,
        source: input.source as string,
        target: input.target as string,
        label: input.label as string | undefined,
      });
      return { success: true, message: `Connected "${input.source}" → "${input.target}"`, edgeId: id };
    }

    case "remove_edge": {
      const idx = state.edges.findIndex((e) => e.id === input.id);
      if (idx === -1) return { success: false, message: `Edge "${input.id}" not found` };
      state.edges.splice(idx, 1);
      return { success: true, message: `Removed edge "${input.id}"` };
    }

    case "move_node": {
      const node = state.nodes.find((n) => n.id === input.id);
      if (!node) return { success: false, message: `Node "${input.id}" not found` };
      node.position = input.position as { x: number; y: number };
      return { success: true, message: `Moved node "${input.id}"` };
    }

    case "clear_canvas": {
      state.nodes = [];
      state.edges = [];
      return { success: true, message: "Canvas cleared" };
    }

    default:
      return { success: false, message: `Unknown tool: ${name}` };
  }
}
