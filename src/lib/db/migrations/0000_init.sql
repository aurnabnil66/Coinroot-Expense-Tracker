CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`opening_date` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`installment_amount` integer,
	`start_date` text,
	`maturity_date` text,
	`interest_rate` real,
	CONSTRAINT "accounts_type_check" CHECK(type IN ('bank', 'cash', 'mobile_wallet', 'savings'))
);
--> statement-breakpoint
CREATE INDEX `accounts_sort_idx` ON `accounts` (`sort_order`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`icon` text,
	`color` text,
	`archived` integer DEFAULT false NOT NULL,
	CONSTRAINT "categories_kind_check" CHECK(kind IN ('expense', 'income_source'))
);
--> statement-breakpoint
CREATE INDEX `categories_kind_idx` ON `categories` (`kind`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`parent_id` text,
	`party` text,
	CONSTRAINT "transactions_type_check" CHECK(type IN ('expense', 'income', 'transfer')),
	CONSTRAINT "transactions_amount_check" CHECK("transactions"."amount" > 0),
	CONSTRAINT "transactions_from_to_check" CHECK("transactions"."from_id" <> "transactions"."to_id")
);
--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_from_idx` ON `transactions` (`from_id`);--> statement-breakpoint
CREATE INDEX `transactions_to_idx` ON `transactions` (`to_id`);--> statement-breakpoint
CREATE INDEX `transactions_parent_idx` ON `transactions` (`parent_id`);