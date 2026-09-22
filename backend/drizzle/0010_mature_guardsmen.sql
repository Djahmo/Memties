ALTER TABLE `people` ADD `user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `people` ADD CONSTRAINT `people_user_id_unique` UNIQUE(`user_id`);--> statement-breakpoint
ALTER TABLE `people` ADD CONSTRAINT `people_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO `people` (`id`, `user_id`, `creator_id`, `display_name`, `email`, `notes`)
SELECT UUID(), `id`, `id`, `display_name`, `email`, '' FROM `users`;
--> statement-breakpoint
INSERT INTO `person_groups` (`person_id`, `group_id`)
SELECT p.id, g.id FROM `people` p
JOIN `groups` g ON g.personal_owner_id = p.user_id;
--> statement-breakpoint
INSERT INTO `entry_people` (`entry_id`, `person_id`)
SELECT e.id, p.id FROM `entries` e
JOIN `people` p ON p.user_id = e.creator_id;
