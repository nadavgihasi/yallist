CREATE TABLE "bag_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "bag_items_quantity_check" CHECK ("bag_items"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "bag_items" ADD CONSTRAINT "bag_items_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bag_items_user_idx" ON "bag_items" USING btree ("user_id");