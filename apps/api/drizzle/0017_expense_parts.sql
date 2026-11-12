CREATE TABLE "expense_part_shares" (
	"part_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "expense_part_shares_part_id_user_id_pk" PRIMARY KEY("part_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "expense_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"amount_agorot" integer NOT NULL,
	CONSTRAINT "expense_parts_amount_check" CHECK ("expense_parts"."amount_agorot" > 0)
);
--> statement-breakpoint
ALTER TABLE "expense_part_shares" ADD CONSTRAINT "expense_part_shares_part_id_expense_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."expense_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_part_shares" ADD CONSTRAINT "expense_part_shares_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_parts" ADD CONSTRAINT "expense_parts_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_parts_expense_idx" ON "expense_parts" USING btree ("expense_id");