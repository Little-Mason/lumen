import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata = { title: 'AI 辅助' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="AI 辅助"
      milestone="W3"
      summary="写作台里的 AI 能力与基于 ContentChunk 的知识库问答，调用统一经 ai.service 收口。"
      capabilities={[
        '生成大纲、标题、标签、摘要与正文润色（流式输出）',
        '知识库问答：切片 → 向量检索 → 带引用回答',
        'AiJob 记录每次调用的 token、成本、耗时与失败原因',
        '模型与 Provider 可切换，密钥只留在服务端',
      ]}
      note="依赖 Step 2 的 Content 数据与 embedding 配置。"
    />
  );
}
