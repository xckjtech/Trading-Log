ALTER TABLE `trades` ADD `exit_date` text;--> statement-breakpoint
ALTER TABLE `trades` ADD `status` text DEFAULT 'closed' NOT NULL;--> statement-breakpoint
UPDATE `trades` SET `exit_date` = `trade_date` WHERE `exit_date` IS NULL;
