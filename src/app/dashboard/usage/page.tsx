import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata = { title: '用量与成本' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="用量与成本"
      milestone="W4"
      summary="按天聚合 AiJob，监控调用量、token、成本、失败率与 P95 延迟。"
      capabilities={[
        '按天 / 按模型 / 按能力类型三个维度筛选',
        'token 与成本趋势图、失败率与 P95 延迟',
        '预算阈值提醒与调用明细下钻',
        '数据来自 AI 模块写入的 AiJob 行',
      ]}
      note="没有 AI 调用数据时该模块天然是空壳，因此排在 AI 辅助之后。"
    />
  );
}
