-- P2-A: Add LeadScore fields to Contact + Company tables
-- P2-A: Create EnrichmentQuota table
-- AI_RULES.md Rule 86-87: OCTA-LOCKED — exact specification

-- ── 1. Contact: LeadScore fields (Rule 87) ──────────────────────────────────
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadScore" INTEGER;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadScoreCategory" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadScoreUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadScoreSource" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadScoreFirmo" INTEGER;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadScoreBehavior" INTEGER;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadScoreQuality" INTEGER;

-- ── 2. Company: LeadScore fields (Rule 87) ─────────────────────────────────
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "leadScore" INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "leadScoreCategory" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "leadScoreUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "leadScoreSource" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "leadScoreFirmo" INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "leadScoreBehavior" INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "leadScoreQuality" INTEGER;

-- ── 3. EnrichmentQuota table (Rule 86) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "EnrichmentQuota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "allowedCredits" INTEGER NOT NULL DEFAULT 20,
    "usedCredits" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" TIMESTAMP(3),
    "rolloverCredits" INTEGER NOT NULL DEFAULT 0,
    "planType" TEXT NOT NULL DEFAULT 'free',
    "features" JSONB,
    "overriddenBy" TEXT,
    "overrideReason" TEXT,
    "overrideCredits" INTEGER,
    "lastConsumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentQuota_workspaceId_key" UNIQUE ("workspaceId")
);

-- ── 4. Foreign key ─────────────────────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EnrichmentQuota_workspaceId_fkey'
    ) THEN
        ALTER TABLE "EnrichmentQuota" ADD CONSTRAINT "EnrichmentQuota_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ── 5. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "EnrichmentQuota_workspaceId_idx" ON "EnrichmentQuota"("workspaceId");
CREATE INDEX IF NOT EXISTS "EnrichmentQuota_periodEnd_idx" ON "EnrichmentQuota"("periodEnd");
CREATE INDEX IF NOT EXISTS "EnrichmentQuota_planType_idx" ON "EnrichmentQuota"("planType");

-- ── 6. Mark migration as applied ───────────────────────────────────────────
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    '20260728_p2a_lead_scoring_and_enrichment_quota',
    'p2a-migration-checksum',
    NOW(),
    '20260728_p2a_lead_scoring_and_enrichment_quota',
    '',
    NULL,
    NOW(),
    1
)
ON CONFLICT ("id") DO NOTHING;
