CREATE TABLE "item_packed" (
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"packed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_packed_item_id_user_id_pk" PRIMARY KEY("item_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "item_packed" ADD CONSTRAINT "item_packed_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_packed" ADD CONSTRAINT "item_packed_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;