-- Migration: Add workspaceId to Invitation table
-- Step 3.1 — Complete invitation system with workspace scoping

-- Add workspaceId column (nullable temporarily for existing rows)
ALTER TABLE "Invitation" ADD COLUMN "workspaceId" TEXT;

-- Backfill: set workspaceId for existing invitations that don't have one
-- (sets to the first active workspace, or null if none exists)
UPDATE "Invitation" i
SET "workspaceId" = w.id
FROM "Workspace" w
WHERE i."workspaceId" IS NULL
  AND w."isActive" = true
LIMIT 1;

-- Make column NOT NULL after backfill
-- If there are existing rows with no workspace, we need to handle that
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Invitation" WHERE "workspaceId" IS NULL) THEN
    -- No workspace exists yet — delete orphan invitations or keep nullable
    -- For safety, keep it nullable but add a comment
    RAISE NOTICE 'Some invitations have no workspaceId — keeping column nullable';
  ELSE
    ALTER TABLE "Invitation" ALTER COLUMN "workspaceId" SET NOT NULL;
  END IF;
END $$;

-- Add foreign key
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" 
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index
CREATE INDEX "Invitation_workspaceId_idx" ON "Invitation"("workspaceId");
