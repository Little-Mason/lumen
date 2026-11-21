import { z } from 'zod';
import { CONTENT_STATUSES, CONTENT_TYPES } from '@/lib/content/domain';

export const contentTypeSchema = z.enum(CONTENT_TYPES);
export const contentStatusSchema = z.enum(CONTENT_STATUSES);

const title = z.string().trim().min(1, '标题不能为空').max(200, '标题最多 200 字');
const contentMd = z.string().min(1, '正文不能为空').max(200_000, '正文过长');
const excerpt = z.string().trim().max(300, '摘要最多 300 字').optional().nullable();
const coverUrl = z.string().trim().url('封面必须是合法 URL').optional().nullable();
const tags = z.union([z.string(), z.array(z.string())]).optional();

export const createContentSchema = z.object({
  title,
  contentMd,
  type: contentTypeSchema.default('ARTICLE'),
  excerpt,
  coverUrl,
  tags,
});

export const updateContentSchema = z
  .object({
    title: title.optional(),
    contentMd: contentMd.optional(),
    type: contentTypeSchema.optional(),
    excerpt,
    coverUrl,
    tags,
    status: contentStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: '至少提供一个待更新字段' });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  type: contentTypeSchema.optional(),
  status: contentStatusSchema.optional(),
  tag: z.string().trim().min(1).optional(),
  q: z.string().trim().max(100).optional(),
});

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
