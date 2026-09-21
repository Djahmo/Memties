CREATE TABLE `entry_tags` (
	`entry_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`tag_id` varchar(36) NOT NULL,
	CONSTRAINT `entry_tags_entry_id_user_id_pk` PRIMARY KEY(`entry_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`color` varchar(7) NOT NULL,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `entry_tags` ADD CONSTRAINT `entry_tags_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entry_tags` ADD CONSTRAINT `entry_tags_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entry_tags` ADD CONSTRAINT `entry_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tags` ADD CONSTRAINT `tags_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `entry_tag` ON `entry_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `tag_user` ON `tags` (`user_id`);