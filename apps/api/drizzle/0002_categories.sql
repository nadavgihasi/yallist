CREATE TABLE "trip_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"list" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_categories_list_check" CHECK ("trip_categories"."list" in ('bring', 'buy'))
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "trip_categories" ADD CONSTRAINT "trip_categories_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_categories_name_idx" ON "trip_categories" USING btree ("trip_id","list","name");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_trip_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."trip_categories"("id") ON DELETE no action ON UPDATE no action;