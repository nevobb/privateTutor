import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageContent } from "../../../src/components/chat/MessageContent";

describe("MessageContent module", () => {
  it("renders plain Hebrew text", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, { content: "שלום, זו בדיקת טקסט.", dir: "auto", lang: "he" })
    );
    expect(html).toContain("שלום, זו בדיקת טקסט.");
    expect(html).toContain("message-content");
  });

  it("renders inline math for $...$ with KaTeX markers", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, { content: "משוואה: $x^2+y^2=r^2$" })
    );
    expect(html).not.toContain("$x^2+y^2=r^2$");
    expect(html).toContain("katex");
  });

  it("renders inline math for \\(...\\) with KaTeX markers", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, { content: "משוואה: \\(x^2\\)" })
    );
    expect(html).not.toContain("\\(");
    expect(html).not.toContain("\\)");
    expect(html).toContain("katex");
  });

  it("keeps Hebrew text before and after inline math in logical order", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, { content: "לפני \\(x^2\\) אחרי" })
    );
    expect(html).toContain("לפני");
    expect(html).toContain("אחרי");
    expect(html.indexOf("לפני")).toBeLessThan(html.indexOf("אחרי"));
    expect(html).toContain("katex");
  });

  it("renders block-style $$...$$ math with KaTeX output", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, { content: "כוח:\n$$F=ma$$" })
    );
    expect(html).not.toContain("$$F=ma$$");
    expect(html).toContain("katex");
  });

  it("renders display math for \\[...\\] with KaTeX markers", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, { content: "כוח:\n\\[F=ma\\]" })
    );
    expect(html).not.toContain("\\[");
    expect(html).not.toContain("\\]");
    expect(html).toContain("katex-display");
  });

  it("renders quadratic formula without RTL mirroring hooks", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, {
        content: "נוסחת השורשים:\n\\[\nx=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}\n\\]",
      })
    );
    expect(html).toContain("katex-display");
    expect(html).toContain("dir=\"ltr\"");
    expect(html).toContain("math-ltr-isolate");
    expect(html).not.toContain("\\[");
    expect(html).not.toContain("\\]");
    expect(html).toContain("annotation");
    expect(html).toContain("x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}");
  });

  it("renders Hebrew text together with \\(...\\) math", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, { content: "הנגזרת של \\(x^2\\) היא \\(2x\\)." })
    );
    expect(html).toContain("הנגזרת של");
    expect(html).toContain("katex");
  });

  it("keeps inline code as code and does not render KaTeX inside it", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, { content: "פקודה: `\\(x^2\\)`" })
    );
    expect(html).toContain("<code");
    expect(html).toContain("\\(x^2\\)");
    expect(html).not.toContain("katex");
  });

  it("keeps code blocks as code and does not render KaTeX inside them", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, { content: "```txt\n\\(x^2\\)\n```" })
    );
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
    expect(html).toContain("\\(x^2\\)");
    expect(html).not.toContain("katex");
  });

  it("renders rtl content container hooks for direction-safe styling", () => {
    const html = renderToStaticMarkup(
      React.createElement(MessageContent, { content: "עברית עם מתמטיקה \\(x^2\\)", dir: "rtl", lang: "he" })
    );
    expect(html).toContain("message-content");
    expect(html).toContain("dir=\"rtl\"");
  });

  it("does not crash on malformed LaTeX and still returns output", () => {
    const render = () =>
      renderToStaticMarkup(
        React.createElement(MessageContent, { content: "Broken: \\(\\frac{1}{\\)" })
      );
    expect(render).not.toThrow();
    const html = render();
    expect(html.length).toBeGreaterThan(0);
  });
});

describe("Teaching contract — LaTeX output requirement", () => {
  it("TUTOR_TEACHING_CONTRACT requires LaTeX display format", async () => {
    const { TUTOR_TEACHING_CONTRACT } = await import(
      "../../../src/server/tutor/teachingContract"
    );
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/LaTeX/i);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/display/i);
  });

  it("TUTOR_TEACHING_CONTRACT specifies separation from Hebrew text", async () => {
    const { TUTOR_TEACHING_CONTRACT } = await import(
      "../../../src/server/tutor/teachingContract"
    );
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/visually separated/i);
  });

  it("PUBLIC_TEACHING_CONTRACT_SUMMARY mentions LaTeX", async () => {
    const { PUBLIC_TEACHING_CONTRACT_SUMMARY } = await import(
      "../../../src/server/tutor/teachingContract"
    );
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/LaTeX/i);
  });
});
