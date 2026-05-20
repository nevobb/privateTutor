"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MessageContentProps {
  content: string;
  dir?: "auto" | "ltr" | "rtl";
  lang?: string;
  className?: string;
  style?: React.CSSProperties;
}

type HastNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function normalizeLatexDelimitersOutsideCode(input: string): string {
  const fencePattern = /```[\s\S]*?```/g;
  let result = "";
  let lastFenceEnd = 0;
  let fenceMatch: RegExpExecArray | null;

  while ((fenceMatch = fencePattern.exec(input)) !== null) {
    const beforeFence = input.slice(lastFenceEnd, fenceMatch.index);
    result += normalizeLatexDelimitersOutsideInlineCode(beforeFence);
    result += fenceMatch[0];
    lastFenceEnd = fenceMatch.index + fenceMatch[0].length;
  }

  result += normalizeLatexDelimitersOutsideInlineCode(input.slice(lastFenceEnd));
  return result;
}

function normalizeLatexDelimitersOutsideInlineCode(input: string): string {
  const inlineCodePattern = /`[^`\n]*`/g;
  let result = "";
  let lastInlineEnd = 0;
  let inlineMatch: RegExpExecArray | null;

  while ((inlineMatch = inlineCodePattern.exec(input)) !== null) {
    const beforeInlineCode = input.slice(lastInlineEnd, inlineMatch.index);
    result += normalizeLatexDelimiters(beforeInlineCode);
    result += inlineMatch[0];
    lastInlineEnd = inlineMatch.index + inlineMatch[0].length;
  }

  result += normalizeLatexDelimiters(input.slice(lastInlineEnd));
  return result;
}

function normalizeLatexDelimiters(input: string): string {
  return input
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_, expression: string) => `\n\n$$\n${expression}\n$$\n\n`)
    .replace(/\\\(((?:.|\n)*?)\\\)/g, (_, expression: string) => `$${expression}$`);
}

function hasClass(node: HastNode, className: string): boolean {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value.includes(className);
  if (typeof value === "string") return value.split(/\s+/).includes(className);
  return false;
}

function ensureClass(node: HastNode, className: string): void {
  const value = node.properties?.className;
  if (Array.isArray(value)) {
    if (!value.includes(className)) value.push(className);
    return;
  }
  if (typeof value === "string") {
    const parts = value.split(/\s+/).filter(Boolean);
    if (!parts.includes(className)) parts.push(className);
    node.properties = { ...node.properties, className: parts };
    return;
  }
  node.properties = { ...node.properties, className: [className] };
}

function markKatexDirection(node: HastNode): void {
  if (!node || typeof node !== "object") return;

  if (node.type === "element") {
    const isKatex = hasClass(node, "katex");
    const isKatexDisplay = hasClass(node, "katex-display");
    if (isKatex || isKatexDisplay) {
      node.properties = { ...(node.properties ?? {}), dir: "ltr" };
      ensureClass(node, "math-ltr-isolate");
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      markKatexDirection(child);
    }
  }
}

function rehypeMathDirectionality() {
  return (tree: HastNode) => {
    markKatexDirection(tree);
  };
}

/**
 * Renders Markdown + LaTeX math in tutor chat messages.
 * - Inline math: \( ... \) or $ ... $
 * - Display math: \[ ... \] or $$ ... $$
 * - Code blocks rendered as-is without math interpretation.
 * - Malformed LaTeX caught by KaTeX's error handling (renders in red, no crash).
 */
export function MessageContent({ content, dir, lang, className, style }: MessageContentProps) {
  const normalizedContent = normalizeLatexDelimitersOutsideCode(content);

  return (
    <div
      className={`message-content${className ? ` ${className}` : ""}`}
      dir={dir}
      lang={lang}
      style={style}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeMathDirectionality]}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
