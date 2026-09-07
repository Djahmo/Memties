CREATE TABLE `push_subscriptions` (
	`endpoint_hash` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` varchar(100) NOT NULL,
	`auth` varchar(30) NOT NULL,
	CONSTRAINT `push_subscriptions_endpoint_hash` PRIMARY KEY(`endpoint_hash`)
);
--> statement-breakpoint
ALTER TABLE `reminders` ADD `notify_by_push` enum('yes','no') DEFAULT 'no' NOT NULL;--> statement-breakpoint
ALTER TABLE `reminders` ADD `push_notified_at` datetime(3);--> statement-breakpoint
ALTER TABLE `reminders` ADD `push_attempt_at` datetime(3);--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `push_user` ON `push_subscriptions` (`user_id`);