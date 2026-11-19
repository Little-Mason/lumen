import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Lumen · AI 内容中枢', template: '%s | Lumen' },
  description: '把技术文章、小说连载与学习笔记统一管理的 AI 内容工作台',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: { type: 'website', locale: 'zh_CN', siteName: 'Lumen' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <header className="border-b border-black/10">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            <a href="/" className="text-lg font-semibold tracking-tight">Lumen</a>
            <nav className="flex gap-5 text-sm text-black/60">
              <a href="/posts/building-lumen">文章</a>
              <a href="/dashboard">工作台</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-5 py-10 text-sm text-black/40">
          Lumen · AI-native content hub · v0.1
        </footer>
      </body>
    </html>
  );
}
