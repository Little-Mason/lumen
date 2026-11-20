import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata = { title: '内容' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="内容"
      milestone="W2"
      summary="统一内容模型：技术博客、小说章节、学习笔记共用一个 Content 表，是其余三个模块的数据源。"
      capabilities={[
        '草稿 / 评审 / 已发布 / 归档四种状态，按类型与状态筛选',
        '新建与编辑页（客户端编辑器 + Server Action 提交）',
        'GET/POST /api/contents 与 GET/PATCH/DELETE /api/contents/:id',
        'POST /api/contents/:id/publish 与 GET /api/tags',
      ]}
      note="Step 2 会在门禁 A（数据库）通过后优先实现。"
    />
  );
}
