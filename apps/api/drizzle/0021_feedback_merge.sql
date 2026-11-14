ALTER TABLE "feedback" ADD COLUMN "merge_sha" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "merge_message_id" integer;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "merged_by" text;