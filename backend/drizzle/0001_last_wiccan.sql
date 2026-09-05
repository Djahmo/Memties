CREATE TABLE `entries` (
	`id` varchar(36) NOT NULL,
	`title` varchar(240) NOT NULL,
	`body` text NOT NULL,
	`occurred_at` datetime(3) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	`creator_id` varchar(36) NOT NULL,
	`source` enum('web','mcp') NOT NULL DEFAULT 'web',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entry_people` (
	`entry_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	CONSTRAINT `entry_people_entry_id_person_id_pk` PRIMARY KEY(`entry_id`,`person_id`)
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` varchar(36) NOT NULL,
	`first_name` varchar(120) NOT NULL DEFAULT '',
	`last_name` varchar(120) NOT NULL DEFAULT '',
	`display_name` varchar(240) NOT NULL,
	`nickname` varchar(120) NOT NULL DEFAULT '',
	`email` varchar(254) NOT NULL DEFAULT '',
	`phone` varchar(80) NOT NULL DEFAULT '',
	`organization` varchar(240) NOT NULL DEFAULT '',
	`job_title` varchar(240) NOT NULL DEFAULT '',
	`notes` text NOT NULL,
	`creator_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `people_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `person_groups` (
	`person_id` varchar(36) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	CONSTRAINT `person_groups_person_id_group_id_pk` PRIMARY KEY(`person_id`,`group_id`)
);
--> statement-breakpoint
ALTER TABLE `entries` ADD CONSTRAINT `entries_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entries` ADD CONSTRAINT `entries_creator_id_users_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entry_people` ADD CONSTRAINT `entry_people_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entry_people` ADD CONSTRAINT `entry_people_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `people` ADD CONSTRAINT `people_creator_id_users_id_fk` FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_groups` ADD CONSTRAINT `person_groups_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `person_groups` ADD CONSTRAINT `person_groups_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `entry_group_date` ON `entries` (`group_id`,`occurred_at`,`id`);--> statement-breakpoint
CREATE INDEX `person_history` ON `entry_people` (`person_id`,`entry_id`);--> statement-breakpoint
CREATE INDEX `person_name` ON `people` (`display_name`);--> statement-breakpoint
CREATE INDEX `person_email` ON `people` (`email`);--> statement-breakpoint
CREATE INDEX `person_group_scope` ON `person_groups` (`group_id`,`person_id`);