import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata = { title: '发布日历' };

export default function Page() {
  return (
    <ModulePlaceholder
      title="发布日历"
      milestone="W4"
      summary="自媒体排期与小说连载更新节奏，只读 Content.publishedAt，最独立、风险最低。"
      capabilities={[
        '月视图 / 周视图与按内容类型着色',
        '拖拽调整排期，回写 publishedAt',
        '连载章节计数与断更提醒',
        '与首页已发布列表共享同一数据源',
      ]}
      note="只依赖 Content 的发布时间，排在最后实现。"
    />
  );
}
