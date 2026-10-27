CREATE TABLE "expense_items" (
	"expense_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "expense_items_expense_id_item_id_pk" PRIMARY KEY("expense_id","item_id"),
	CONSTRAINT "expense_items_item_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "shopping_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"shopper_id" uuid NOT NULL,
	"status" text NOT NULL,
	"active" boolean,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"expense_id" uuid,
	CONSTRAINT "shopping_runs_active_unique" UNIQUE("trip_id","shopper_id","active"),
	CONSTRAINT "shopping_runs_status_check" CHECK ("shopping_runs"."status" in ('active', 'done', 'cancelled')),
	CONSTRAINT "shopping_runs_active_check" CHECK (("shopping_runs"."status" = 'active' and "shopping_runs"."active") or ("shopping_runs"."status" <> 'active' and "shopping_runs"."active" is null))
);
--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "in_cart_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_runs" ADD CONSTRAINT "shopping_runs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_runs" ADD CONSTRAINT "shopping_runs_shopper_id_profiles_id_fk" FOREIGN KEY ("shopper_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_runs" ADD CONSTRAINT "shopping_runs_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_run_id_shopping_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."shopping_runs"("id") ON DELETE no action ON UPDATE no action;