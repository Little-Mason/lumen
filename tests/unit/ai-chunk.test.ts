import { describe, expect, it } from 'vitest';
import { chunkMarkdown, splitBlocks } from '@/lib/ai/chunk';

const cosine = (a: number[], b: number[]) => {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
};

describe('splitBlocks', () => {
  it('按标题与空行切块，并记住所属标题', () => {
    const blocks = splitBlocks('# 一\n\n第一段\n\n## 二\n\n第二段');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.heading).toBe('一');
    expect(blocks[0]?.text).toBe('第一段');
    expect(blocks[1]?.heading).toBe('二');
    expect(blocks[1]?.text).toBe('第二段');
  });
});

describe('chunkMarkdown', () => {
  it('空文档不产生切片', () => {
    expect(chunkMarkdown('')).toEqual([]);
    expect(chunkMarkdown('  \n\n  ')).toEqual([]);
  });

  it('短文档只产生一个带标题的切片', () => {
    const chunks = chunkMarkdown('# 标题\n\n一段很短的正文。', { size: 700, overlap: 80 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.chunkIndex).toBe(0);
    expect(chunks[0]?.text).toContain('## 标题');
    expect(chunks[0]?.text).toContain('一段很短的正文');
    expect(chunks[0]?.tokenCount).toBeGreaterThan(0);
  });

  it('长文档产生多个连续切片，且长度受控', () => {
    const body = Array.from(
      { length: 24 },
      (_, i) => `第 ${i} 段：` + '内容检索与向量化。'.repeat(30),
    ).join('\n\n');
    const chunks = chunkMarkdown(`# 长文\n\n${body}`, { size: 300, overlap: 40 });

    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(
      Array.from({ length: chunks.length }, (_, i) => i),
    );
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(400);
      expect(chunk.text.length).toBeGreaterThan(20);
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });

  it('相邻切片保留重叠，且不会出现只有重叠的空切片', () => {
    const body = '甲乙丙丁'.repeat(120) + '\n\n' + '戊己庚辛'.repeat(120);
    const chunks = chunkMarkdown(body, { size: 300, overlap: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    const first = chunks[0]?.text ?? '';
    const second = chunks[1]?.text ?? '';
    expect(second).toContain(first.slice(-40));
    expect(second.length).toBeGreaterThan(40);
  });

  it('单个超长段落退化为窗口切片', () => {
    const chunks = chunkMarkdown('向量'.repeat(3000), { size: 300, overlap: 40 });
    expect(chunks.length).toBeGreaterThan(5);
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(400);
  });

  it('换标题时不把上一节尾部带进新节', () => {
    const chunks = chunkMarkdown(`## A\n\n${'甲'.repeat(400)}\n\n## B\n\n${'乙'.repeat(400)}`, {
      size: 300,
      overlap: 40,
    });
    const sectionB = chunks.find((chunk) => chunk.text.includes('## B'));
    expect(sectionB?.text).toBeDefined();
    expect(sectionB?.text.split('## B')[1]).not.toContain('甲');
  });
});

describe('mock embedding 的语义倾向（供检索单测复用）', () => {
  it('相近文本的点积高于无关文本', async () => {
    const { mockEmbedding } = await import('@/lib/ai/mock');
    const base = mockEmbedding('pgvector HNSW 向量检索');
    const close = mockEmbedding('pgvector HNSW 向量检索入门');
    const far = mockEmbedding('雅思写作与减脂计划');
    expect(cosine(base, close)).toBeGreaterThan(cosine(base, far));
  });
});
