ALTER TABLE "feedback" ADD COLUMN "pipeline_state" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "telegram_message_id" integer;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "telegram_prompt_id" integer;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "owner_details" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "routine_session_url" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "pr_number" integer;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "preview_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_pipeline_state_check" CHECK ("feedback"."pipeline_state" in ('sent', 'awaiting_details', 'approved', 'rejected', 'done'));