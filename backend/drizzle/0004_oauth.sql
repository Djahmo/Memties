CREATE TABLE `oauth_records` (
  `id` varchar(80) NOT NULL,
  `value` text NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  CONSTRAINT `oauth_records_id` PRIMARY KEY (`id`)
);
--> statement-breakpoint
CREATE INDEX `oauth_expiry` ON `oauth_records` (`expires_at`);
