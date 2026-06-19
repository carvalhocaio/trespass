ALTER TYPE "public"."scan_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "scan" ADD COLUMN "progress" jsonb;