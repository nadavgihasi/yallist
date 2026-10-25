CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text DEFAULT 'feature' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"app_version" text NOT NULL,
	"platform" text NOT NULL,
	"stage" text NOT NULL,
	"github_issue_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_kind_check" CHECK ("feedback"."kind" in ('feature', 'bug')),
	CONSTRAINT "feedback_platform_check" CHECK ("feedback"."platform" in ('ios', 'android', 'web'))
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "feedback" USING btree ("user_id","created_at");