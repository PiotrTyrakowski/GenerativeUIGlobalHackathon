"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  streamingText: string;
  isRunning: boolean;
  onSend: (text: string) => void;
}

export function ChatPanel({
  messages,
  streamingText,
  isRunning,
  onSend,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isRunning) return;
    setInput("");
    onSend(text);
  };

  return (
    <div className="w-[380px] border-l border-neutral-800 flex flex-col bg-neutral-900/95 backdrop-blur-sm">
      <div className="p-4 border-b border-neutral-800 shrink-0">
        <h2 className="text-sm font-semibold text-neutral-200">Canvas Chat</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Tell Claude what to build on the canvas
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streamingText && (
          <div className="text-center mt-12 space-y-3">
            <div className="text-neutral-600 text-sm">No messages yet</div>
            <div className="space-y-1.5 text-xs text-neutral-500">
              <p>Try something like:</p>
              <p className="text-neutral-400">&quot;Create a project planning board with 5 tasks&quot;</p>
              <p className="text-neutral-400">&quot;Make a mind map about machine learning&quot;</p>
              <p className="text-neutral-400">&quot;Add three connected workflow steps&quot;</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-200"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-3.5 py-2 text-sm bg-neutral-800 text-neutral-200 leading-relaxed">
              <p className="whitespace-pre-wrap break-words">{streamingText}</p>
              <span className="inline-block w-1 h-3.5 bg-blue-400 animate-pulse ml-0.5 align-text-bottom" />
            </div>
          </div>
        )}

        {isRunning && !streamingText && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3.5 py-2.5 bg-neutral-800">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-neutral-800 shrink-0"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isRunning ? "Claude is working..." : "Message Claude..."}
            disabled={isRunning}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={isRunning || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
