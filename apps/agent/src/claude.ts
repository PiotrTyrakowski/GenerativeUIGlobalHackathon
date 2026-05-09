import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { canvasTools, executeCanvasTool, type CanvasState } from "./tools.js";

const client = new Anthropic();

type EmitFn = (event: Record<string, unknown>) => Promise<void>;

function buildSystemPrompt(canvas: CanvasState): string {
  const stateDesc =
    canvas.nodes.length === 0
      ? "The canvas is currently empty."
      : `The canvas has ${canvas.nodes.length} node(s) and ${canvas.edges.length} edge(s):\n${JSON.stringify(canvas, null, 2)}`;

  return `You are an AI assistant that controls an interactive infinite canvas. Users ask you to create, modify, and organize visual elements on the canvas.

Current canvas state:
${stateDesc}

Guidelines:
- Space nodes 250-300px apart for readability. Start near (100, 100) and arrange logically.
- Use descriptive labels and content for every node.
- Choose the right node type: "generic" for general content, "note" for text, "task" for actionable items.
- Connect related nodes with edges when it makes semantic sense.
- Always use your tools to modify the canvas. Don't just describe what you'd do.
- After making changes, give a brief conversational summary of what you did.`;
}

interface StreamResult {
  contentBlocks: Anthropic.ContentBlock[];
  stopReason: string;
}

async function streamClaude(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  emit: EmitFn,
): Promise<StreamResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
    tools: canvasTools as Anthropic.Tool[],
    stream: true,
  });

  const contentBlocks: Record<number, { type: string; text?: string; id?: string; name?: string; _inputJson?: string; input?: unknown }> = {};
  let textMessageId = "";
  let toolCallId = "";
  let stopReason = "end_turn";

  for await (const event of response) {
    switch (event.type) {
      case "content_block_start": {
        const block = event.content_block;
        contentBlocks[event.index] = { ...block } as typeof contentBlocks[number];

        if (block.type === "text") {
          textMessageId = randomUUID();
          await emit({
            type: "TEXT_MESSAGE_START",
            messageId: textMessageId,
            role: "assistant",
          });
        } else if (block.type === "tool_use") {
          toolCallId = block.id;
          contentBlocks[event.index]._inputJson = "";
          await emit({
            type: "TOOL_CALL_START",
            toolCallId: block.id,
            toolCallName: block.name,
          });
        }
        break;
      }

      case "content_block_delta": {
        if (event.delta.type === "text_delta") {
          const cb = contentBlocks[event.index];
          cb.text = (cb.text || "") + event.delta.text;
          await emit({
            type: "TEXT_MESSAGE_CONTENT",
            messageId: textMessageId,
            delta: event.delta.text,
          });
        } else if (event.delta.type === "input_json_delta") {
          contentBlocks[event.index]._inputJson! += event.delta.partial_json;
          await emit({
            type: "TOOL_CALL_ARGS",
            toolCallId,
            delta: event.delta.partial_json,
          });
        }
        break;
      }

      case "content_block_stop": {
        const cb = contentBlocks[event.index];
        if (cb.type === "text" && textMessageId) {
          await emit({ type: "TEXT_MESSAGE_END", messageId: textMessageId });
          textMessageId = "";
        } else if (cb.type === "tool_use") {
          await emit({ type: "TOOL_CALL_END", toolCallId });
          cb.input = JSON.parse(cb._inputJson || "{}");
          delete cb._inputJson;
          toolCallId = "";
        }
        break;
      }

      case "message_delta": {
        if ("stop_reason" in event.delta && event.delta.stop_reason) {
          stopReason = event.delta.stop_reason;
        }
        break;
      }
    }
  }

  const sortedBlocks = Object.entries(contentBlocks)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, block]) => block as unknown as Anthropic.ContentBlock);

  return { contentBlocks: sortedBlocks, stopReason };
}

export async function handleAgentRun(input: {
  threadId?: string;
  runId?: string;
  messages?: Array<{ role: string; content: string }>;
  state?: CanvasState;
}, emit: EmitFn): Promise<void> {
  const threadId = input.threadId || "main";
  const runId = input.runId || randomUUID();
  const canvasState: CanvasState = input.state?.nodes
    ? { nodes: [...input.state.nodes], edges: [...input.state.edges] }
    : { nodes: [], edges: [] };

  await emit({ type: "RUN_STARTED", threadId, runId });

  try {
    let currentMessages: Anthropic.MessageParam[] = (input.messages || [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    let looping = true;
    while (looping) {
      const systemPrompt = buildSystemPrompt(canvasState);
      const { contentBlocks, stopReason } = await streamClaude(
        systemPrompt,
        currentMessages,
        emit,
      );

      if (stopReason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of contentBlocks) {
          if (block.type === "tool_use") {
            const result = executeCanvasTool(
              block.name,
              block.input as Record<string, unknown>,
              canvasState,
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }

        await emit({
          type: "STATE_SNAPSHOT",
          snapshot: { nodes: canvasState.nodes, edges: canvasState.edges },
        });

        currentMessages = [
          ...currentMessages,
          { role: "assistant", content: contentBlocks },
          { role: "user", content: toolResults },
        ];
      } else {
        looping = false;
      }
    }

    await emit({ type: "RUN_FINISHED", threadId, runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Agent run error:", error);
    await emit({ type: "RUN_ERROR", message });
  }
}
