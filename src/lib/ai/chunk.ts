/**
 * Markdown 感知切片：优先按标题与段落边界，超长段落才退化为字符窗口。
 * 每个切片带上所属标题，检索命中后更容易判断上下文；相邻切片保留 overlap。
 */
export type TextChunk = { chunkIndex: number; text: string; tokenCount: number };
export type ChunkOptions = { size?: number; overlap?: number };

type Block = { heading: string | null; text: string };

export function splitBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text) blocks.push({ heading, text });
    buffer = [];
  };

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      flush();
      heading = match[2]?.trim() ?? null;
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return blocks;
}

/** 超长单段退化为定长窗口；窗口预留 overlap 空间，避免产生「只有重叠」的空切片。 */
function splitLong(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const pieces: string[] = [];
  for (let start = 0; start < text.length; start += width) {
    pieces.push(text.slice(start, start + width));
    if (start + width >= text.length) break;
  }
  return pieces;
}

export function chunkMarkdown(markdown: string, options: ChunkOptions = {}): TextChunk[] {
  const size = Math.max(200, options.size ?? 700);
  const overlap = Math.min(size - 100, Math.max(0, options.overlap ?? 80));
  const blocks = splitBlocks(markdown);
  if (blocks.length === 0) return [];

  // 预留标题前缀与 overlap，保证 carry + 新段不会再次撑爆 size。
  const width = Math.max(80, size - overlap - 40);
  const chunks: string[] = [];
  let heading = '';
  let buffer = '';

  const flush = () => {
    const body = buffer.trim();
    if (!body) {
      buffer = '';
      return;
    }
    chunks.push(heading ? `${heading}\n\n${body}` : body);
    buffer = overlap > 0 ? body.slice(-overlap) : '';
  };

  for (const block of blocks) {
    if (block.heading) {
      flush();
      buffer = ''; // 换标题时不跨节重叠
      heading = `## ${block.heading}`;
    }
    for (const piece of splitLong(block.text, width)) {
      if (buffer.trim() && buffer.length + piece.length + 2 > size) flush();
      buffer = buffer.trim() ? `${buffer.trim()}\n\n${piece}` : piece;
    }
  }

  const tail = buffer.trim();
  if (tail) chunks.push(heading ? `${heading}\n\n${tail}` : tail);

  return chunks.map((text, chunkIndex) => ({
    chunkIndex,
    text,
    tokenCount: Math.ceil(text.length / 2),
  }));
}
