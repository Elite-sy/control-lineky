-- Portal Client Schema: new models + extended Deal, Conversation, Message
-- Created via prisma db push + manual migration file (shadow DB unavailable due to pre-existing drift)

-- AlterTable: Deal — add portal client extension fields
ALTER TABLE "Deal" ADD COLUMN "progressPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Deal" ADD COLUMN "healthStatus" TEXT NOT NULL DEFAULT 'on_track';
ALTER TABLE "Deal" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN "affaireType" TEXT;

-- AlterTable: Conversation — link to Contact and Deal
ALTER TABLE "Conversation" ADD COLUMN "contactId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "dealId" TEXT;

-- AlterTable: Message — attachments, scheduling, read receipts
ALTER TABLE "Message" ADD COLUMN "attachments" JSONB;
ALTER TABLE "Message" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "readAt" TIMESTAMP(3);

-- CreateTable: Milestone
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "requiresClientApproval" BOOLEAN NOT NULL DEFAULT false,
    "clientApprovedAt" TIMESTAMP(3),
    "clientApprovedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProgressPhoto
CREATE TABLE "ProgressPhoto" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Quote
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "dealId" TEXT,
    "contactId" TEXT,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pdfUrl" TEXT,
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable: QuoteLineItem
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ClientAccount
CREATE TABLE "ClientAccount" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "authUserId" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'decision_maker',
    "status" TEXT NOT NULL DEFAULT 'invited',
    "invitedBy" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SignatureRecord
CREATE TABLE "SignatureRecord" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "signedBy" TEXT NOT NULL,
    "signedByAccountId" TEXT,
    "signatureData" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quoteId" TEXT,
    "milestoneId" TEXT,

    CONSTRAINT "SignatureRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PortalMessage
CREATE TABLE "PortalMessage" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderAccountId" TEXT,
    "attachments" JSONB,
    "readAt" TIMESTAMP(3),
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: KnowledgeBaseArticle
CREATE TABLE "KnowledgeBaseArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "summary" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Milestone
CREATE INDEX "Milestone_dealId_idx" ON "Milestone"("dealId");
CREATE INDEX "Milestone_status_idx" ON "Milestone"("status");
CREATE INDEX "Milestone_order_idx" ON "Milestone"("order");

-- CreateIndex: ProgressPhoto
CREATE INDEX "ProgressPhoto_dealId_idx" ON "ProgressPhoto"("dealId");
CREATE INDEX "ProgressPhoto_milestoneId_idx" ON "ProgressPhoto"("milestoneId");
CREATE INDEX "ProgressPhoto_takenAt_idx" ON "ProgressPhoto"("takenAt");

-- CreateIndex: Quote
CREATE INDEX "Quote_dealId_idx" ON "Quote"("dealId");
CREATE INDEX "Quote_contactId_idx" ON "Quote"("contactId");
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
CREATE INDEX "Quote_workspaceId_idx" ON "Quote"("workspaceId");

-- CreateIndex: QuoteLineItem
CREATE INDEX "QuoteLineItem_quoteId_idx" ON "QuoteLineItem"("quoteId");

-- CreateIndex: ClientAccount
CREATE INDEX "ClientAccount_authUserId_idx" ON "ClientAccount"("authUserId");
CREATE INDEX "ClientAccount_status_idx" ON "ClientAccount"("status");
CREATE INDEX "ClientAccount_workspaceId_idx" ON "ClientAccount"("workspaceId");

-- CreateIndex: SignatureRecord
CREATE INDEX "SignatureRecord_entityType_entityId_idx" ON "SignatureRecord"("entityType", "entityId");
CREATE INDEX "SignatureRecord_quoteId_idx" ON "SignatureRecord"("quoteId");
CREATE INDEX "SignatureRecord_milestoneId_idx" ON "SignatureRecord"("milestoneId");

-- CreateIndex: PortalMessage
CREATE INDEX "PortalMessage_dealId_idx" ON "PortalMessage"("dealId");
CREATE INDEX "PortalMessage_sender_idx" ON "PortalMessage"("sender");
CREATE INDEX "PortalMessage_createdAt_idx" ON "PortalMessage"("createdAt");

-- CreateIndex: KnowledgeBaseArticle
CREATE INDEX "KnowledgeBaseArticle_category_idx" ON "KnowledgeBaseArticle"("category");
CREATE INDEX "KnowledgeBaseArticle_published_idx" ON "KnowledgeBaseArticle"("published");
CREATE INDEX "KnowledgeBaseArticle_workspaceId_idx" ON "KnowledgeBaseArticle"("workspaceId");

-- CreateIndex: Conversation (new indexes for portal relations)
CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");
CREATE INDEX "Conversation_dealId_idx" ON "Conversation"("dealId");

-- CreateIndex: Message (new index for scheduled sends)
CREATE INDEX "Message_scheduledAt_idx" ON "Message"("scheduledAt");

-- CreateUniqueIndex: Quote
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");

-- CreateUniqueIndex: ClientAccount
CREATE UNIQUE INDEX "ClientAccount_contactId_key" ON "ClientAccount"("contactId");
CREATE UNIQUE INDEX "ClientAccount_authUserId_key" ON "ClientAccount"("authUserId");

-- AddForeignKey: Milestone
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE;

-- AddForeignKey: ProgressPhoto
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE;
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id");

-- AddForeignKey: Quote
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id");

-- AddForeignKey: QuoteLineItem
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE;

-- AddForeignKey: ClientAccount
ALTER TABLE "ClientAccount" ADD CONSTRAINT "ClientAccount_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id");

-- AddForeignKey: SignatureRecord
ALTER TABLE "SignatureRecord" ADD CONSTRAINT "SignatureRecord_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id");
ALTER TABLE "SignatureRecord" ADD CONSTRAINT "SignatureRecord_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id");

-- AddForeignKey: PortalMessage
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE;

-- AddForeignKey: Conversation (new relations)
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id");
