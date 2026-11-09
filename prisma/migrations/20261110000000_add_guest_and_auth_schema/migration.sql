-- ============================================================================
-- Migration: 20261110000000_add_guest_and_auth_schema
-- Nyaya Sahayak Phase 4A: Guest-First Authentication & Conversation Schema
-- 
-- Safety Audit:
-- - Destructive operations (DROP TABLE, DROP COLUMN): NONE (0)
-- - Breaking schema changes: NONE (0)
-- - Backward compatibility: Retains existing User and Message records;
--   Message.conversationId is nullable; Message.userId made nullable to
--   allow guest conversations while preserving all existing messages.
-- ============================================================================

-- 1. AlterTable User (backward-compatible additions for Google OAuth)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleSub" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Unique Indexes for User
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- 2. CreateTable AuthSession (persistent sessions for authenticated users)
CREATE TABLE IF NOT EXISTS "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- Indexes for AuthSession
CREATE UNIQUE INDEX IF NOT EXISTS "AuthSession_sessionTokenHash_key" ON "AuthSession"("sessionTokenHash");
CREATE INDEX IF NOT EXISTS "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX IF NOT EXISTS "AuthSession_sessionTokenHash_expiresAt_idx" ON "AuthSession"("sessionTokenHash", "expiresAt");

-- ForeignKey AuthSession -> User
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. CreateTable GuestSession (ephemeral sessions for unauthenticated users)
CREATE TABLE IF NOT EXISTS "GuestSession" (
    "id" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- Indexes for GuestSession
CREATE UNIQUE INDEX IF NOT EXISTS "GuestSession_sessionTokenHash_key" ON "GuestSession"("sessionTokenHash");
CREATE INDEX IF NOT EXISTS "GuestSession_sessionTokenHash_expiresAt_idx" ON "GuestSession"("sessionTokenHash", "expiresAt");

-- 4. CreateTable Conversation (supports both authenticated and guest threads)
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'New Inquiry',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- Indexes for Conversation
CREATE INDEX IF NOT EXISTS "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Conversation_guestSessionId_expiresAt_idx" ON "Conversation"("guestSessionId", "expiresAt");

-- ForeignKeys for Conversation
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_guestSessionId_fkey" 
    FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. AlterTable Message (support conversation threading & guest messages)
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "structuredResponse" JSONB;
ALTER TABLE "Message" ALTER COLUMN "userId" DROP NOT NULL;

-- Indexes for Message
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- ForeignKey Message -> Conversation
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" 
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. CreateTable MessageCitation (grounded RAG verification)
CREATE TABLE IF NOT EXISTS "MessageCitation" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "sourceDocument" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "pageRange" TEXT,
    "fidelityClassification" TEXT NOT NULL DEFAULT 'verbatim',
    "publicationDate" TEXT,
    "dataAsOf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageCitation_pkey" PRIMARY KEY ("id")
);

-- Indexes for MessageCitation
CREATE INDEX IF NOT EXISTS "MessageCitation_messageId_idx" ON "MessageCitation"("messageId");
CREATE INDEX IF NOT EXISTS "MessageCitation_chunkId_idx" ON "MessageCitation"("chunkId");

-- ForeignKey MessageCitation -> Message
ALTER TABLE "MessageCitation" ADD CONSTRAINT "MessageCitation_messageId_fkey" 
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. CreateTable AIRequestLog (privacy-preserving operational monitoring)
CREATE TABLE IF NOT EXISTS "AIRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "conversationId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "tokenCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequestLog_pkey" PRIMARY KEY ("id")
);

-- Indexes for AIRequestLog
CREATE INDEX IF NOT EXISTS "AIRequestLog_userId_createdAt_idx" ON "AIRequestLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AIRequestLog_guestSessionId_createdAt_idx" ON "AIRequestLog"("guestSessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "AIRequestLog_conversationId_createdAt_idx" ON "AIRequestLog"("conversationId", "createdAt");

-- ForeignKeys for AIRequestLog
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_guestSessionId_fkey" 
    FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIRequestLog" ADD CONSTRAINT "AIRequestLog_conversationId_fkey" 
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
