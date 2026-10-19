-- AlterTable: Add unique constraint on Contact.email
-- P0-3: Prevent duplicate contact emails

-- Step 1: Clean up existing duplicate emails (keep first occurrence, mark others)
-- This ensures the UNIQUE constraint can be added without errors.
-- Duplicates will have deletedAt set so they don't interfere with active records.

UPDATE "Contact" c1
SET "deletedAt" = NOW()
WHERE EXISTS (
  SELECT 1 FROM "Contact" c2
  WHERE c2.email = c1.email
    AND c2.id < c1.id
    AND c2."deletedAt" IS NULL
);

-- Step 2: Add unique constraint
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_email_key" UNIQUE ("email");
