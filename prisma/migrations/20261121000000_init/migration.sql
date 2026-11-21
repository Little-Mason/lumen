-- Lumen initial schema (W2)
-- Generated with: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- The "vector" extension is created BEFORE this migration via prisma/sql/000_extensions.sql:
-- CREATE EXTENSION needs elevated privileges on managed Postgres, so it must not be
-- embedded in a migration that the application role runs with migrate deploy.
-- The HNSW index is applied afterwards via prisma/sql/001_pgvector.sql.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('ARTICLE', 'CHAPTER', 'NOTE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'EDITOR');

-- CreateEnum
CREATE TYPE "AiJobKind" AS ENUM ('OUTLINE', 'TITLE', 'TAGS', 'SUMMARIZE', 'POLISH', 'RAG_ASK');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "ContentType" NOT NULL DEFAULT 'ARTICLE',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "contentMd" TEXT NOT NULL,
    "coverUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "readingMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT,
    "kind" "AiJobKind" NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentChunk" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(1536),
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ContentToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContentToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Content_slug_key" ON "Content"("slug");

-- CreateIndex
CREATE INDEX "Content_status_publishedAt_idx" ON "Content"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Content_type_status_idx" ON "Content"("type", "status");

-- CreateIndex
CREATE INDEX "Content_authorId_updatedAt_idx" ON "Content"("authorId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "AiJob_userId_createdAt_idx" ON "AiJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiJob_kind_status_idx" ON "AiJob"("kind", "status");

-- CreateIndex
CREATE INDEX "ContentChunk_contentId_idx" ON "ContentChunk"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentChunk_contentId_chunkIndex_key" ON "ContentChunk"("contentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "_ContentToTag_B_index" ON "_ContentToTag"("B");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentChunk" ADD CONSTRAINT "ContentChunk_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContentToTag" ADD CONSTRAINT "_ContentToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContentToTag" ADD CONSTRAINT "_ContentToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
