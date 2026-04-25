import { useMemo } from "react";

interface Props {
  text: string;
}

// Minimal Markdown → HTML renderer (no external deps).
// Handles: headings (h1–h6), bold, italic, inline code, fenced code blocks,
// blockquotes, unordered lists, ordered lists, horizontal rules, and paragraphs.
function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string): string => {
    // Bold+italic
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    // Bold
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
    // Italic
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/_(.+?)_/g, "<em>$1</em>");
    // Inline code
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Links
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(esc(lines[i]));
        i++;
      }
      const langAttr = lang ? ` class="language-${esc(lang)}"` : "";
      out.push(`<pre class="mv-code-block"><code${langAttr}>${codeLines.join("\n")}</code></pre>`);
      i++; // skip closing ```
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      out.push(`<h${level} class="mv-h${level}">${inline(esc(headingMatch[2]))}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push("<hr class=\"mv-hr\" />");
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const bqLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bqLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote class="mv-blockquote">${renderMarkdown(bqLines.join("\n"))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(`<li>${inline(esc(lines[i].replace(/^[-*+]\s/, "")))}</li>`);
        i++;
      }
      out.push(`<ul class="mv-ul">${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inline(esc(lines[i].replace(/^\d+\.\s/, "")))}</li>`);
        i++;
      }
      out.push(`<ol class="mv-ol">${items.join("")}</ol>`);
      continue;
    }

    // Blank line → skip (paragraph separator)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: collect consecutive non-blank, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|```|>|[-*+]\s|\d+\.\s)/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paraLines.push(inline(esc(lines[i])));
      i++;
    }
    if (paraLines.length) {
      out.push(`<p class="mv-p">${paraLines.join("<br />")}</p>`);
    }
  }

  return out.join("\n");
}

export function MarkdownView({ text }: Props) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return (
    <div
      className="mv-root"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
