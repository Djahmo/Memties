CREATE TABLE `group_members` (
	`group_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('owner','editor','viewer') NOT NULL,
	CONSTRAINT `group_members_group_id_user_id_pk` PRIMARY KEY(`group_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(2000) NOT NULL DEFAULT '',
	`parent_id` varchar(36),
	`personal_owner_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `groups_personal_owner_id_unique` UNIQUE(`personal_owner_id`)
);
--> statement-breakpoint
CREATE TABLE `auth_identities` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`provider` varchar(80) NOT NULL,
	`subject` varchar(254) NOT NULL,
	`password_hash` varchar(256),
	CONSTRAINT `auth_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `identity_provider_subject` UNIQUE(`provider`,`subject`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `sessions_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(254) NOT NULL,
	`display_name` varchar(120) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `groups` ADD CONSTRAINT `groups_parent_id_groups_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `groups`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `groups` ADD CONSTRAINT `groups_personal_owner_id_users_id_fk` FOREIGN KEY (`personal_owner_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_identities` ADD CONSTRAINT `auth_identities_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `member_user` ON `group_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `group_parent` ON `groups` (`parent_id`);--> statement-breakpoint
CREATE INDEX `session_expiry` ON `sessions` (`expires_at`);