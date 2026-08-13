CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`trade_date` text NOT NULL,
	`side` text NOT NULL,
	`entry_price` real NOT NULL,
	`exit_price` real NOT NULL,
	`quantity` real NOT NULL,
	`entry_fee` real DEFAULT 0 NOT NULL,
	`exit_fee` real DEFAULT 0 NOT NULL,
	`gross_pnl` real NOT NULL,
	`net_pnl` real NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_trades_user_date` ON `trades` (`user_id`,`trade_date`);