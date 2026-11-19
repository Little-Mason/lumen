import { PrismaClient, ContentStatus, ContentType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const email = process.env.SEED_OWNER_EMAIL ?? 'owner@lumen.local';
  const password = process.env.SEED_OWNER_PASSWORD ?? 'change-me-123';

  const owner = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Lumen Owner',
      passwordHash: await bcrypt.hash(password, 10),
      role: 'OWNER',
    },
  });

  const samples = [
    {
      title: '从 0 到 1 搭一个 AI 内容中枢',
      slug: 'building-lumen',
      type: ContentType.ARTICLE,
      status: ContentStatus.PUBLISHED,
      excerpt: '为什么把技术博客、小说连载和学习笔记放进同一个系统。',
      contentMd: '# 从 0 到 1 搭一个 AI 内容中枢\n\n这是种子内容，用来验证公开列表页与详情页。\n',
      publishedAt: new Date(),
      wordCount: 32,
      readingMinutes: 1,
    },
    {
      title: '第一章 · 起稿',
      slug: 'chapter-01',
      type: ContentType.CHAPTER,
      status: ContentStatus.DRAFT,
      excerpt: '小说连载的第一章草稿。',
      contentMd: '# 第一章 · 起稿\n\n草稿占位。\n',
      wordCount: 12,
      readingMinutes: 1,
    },
  ];

  for (const s of samples) {
    await db.content.upsert({
      where: { slug: s.slug },
      update: {},
      create: { ...s, authorId: owner.id },
    });
  }

  console.warn(`Seeded owner=${email} and ${samples.length} contents.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
