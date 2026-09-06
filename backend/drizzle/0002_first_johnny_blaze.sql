CREATE TABLE `api_tokens` (
	`id` varchar(36) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`access` enum('read','write') NOT NULL DEFAULT 'read',
	`expires_at` datetime(3) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` varchar(36) NOT NULL,
	`entry_id` varchar(36) NOT NULL,
	`title` varchar(240) NOT NULL,
	`due_at` datetime(3) NOT NULL,
	`status` enum('pending','completed') NOT NULL DEFAULT 'pending',
	`creator_id` varchar(36) NOT NULL,
	`notify_by_email` enum('yes','no') NOT NULL DEFAULT 'no',
	`language` enum('fr','en') NOT NULL DEFAULT 'en',
	`notified_at` datetime(3),
	`notification_attempt_at` datetime(3),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saml_requests` (
	`id` varchar(200) NOT NULL,
	`value` text NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `saml_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `api_tokens` ADD CONSTRAINT `api_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_creator_id_users_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `api_token_user` ON `api_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `reminder_entry` ON `reminders` (`entry_id`);--> statement-breakpoint
CREATE INDEX `reminder_due` ON `reminders` (`status`,`due_at`,`id`);