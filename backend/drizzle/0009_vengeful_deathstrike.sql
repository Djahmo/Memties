ALTER TABLE `groups` ADD `position` double DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `groups` AS target
JOIN (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY parent_id
    ORDER BY (personal_owner_id IS NOT NULL) DESC, name, id
  ) * 1024 AS sort_position
  FROM `groups`
) AS ranked ON ranked.id = target.id
SET target.position = ranked.sort_position;
