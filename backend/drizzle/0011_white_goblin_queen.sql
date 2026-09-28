CREATE TABLE `person_dates` (
	`id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`label` varchar(120) NOT NULL,
	`date` varchar(10) NOT NULL,
	`annual_reminder` enum('yes','no') NOT NULL DEFAULT 'no',
	CONSTRAINT `person_dates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `person_dates` ADD CONSTRAINT `person_dates_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `person_date_owner` ON `person_dates` (`person_id`);