-- 迁移前执行：npx prisma db execute --file prisma/sql/000_extensions.sql --schema prisma/schema.prisma
-- CREATE EXTENSION 需要管理员权限；托管 Postgres 请在平台 SQL 编辑器里先手动执行一次。
-- 若扩展已存在，IF NOT EXISTS 只会给出 notice，普通角色也能安全跳过。
CREATE EXTENSION IF NOT EXISTS vector;
