-- Keep only the deepest assigned groups in each branch for every contact.
-- A self contact must retain its system-owned Personal root association.
DELETE parent_link
FROM person_groups AS parent_link
INNER JOIN (
  WITH RECURSIVE ancestors AS (
    SELECT id AS descendant_id, parent_id AS ancestor_id
    FROM `groups`
    WHERE parent_id IS NOT NULL
    UNION DISTINCT
    SELECT ancestors.descendant_id, parent_group.parent_id
    FROM ancestors
    INNER JOIN `groups` AS parent_group ON parent_group.id = ancestors.ancestor_id
    WHERE parent_group.parent_id IS NOT NULL
  )
  SELECT descendant_id, ancestor_id FROM ancestors
) AS ancestors ON ancestors.ancestor_id = parent_link.group_id
INNER JOIN person_groups AS child_link
  ON child_link.person_id = parent_link.person_id
  AND child_link.group_id = ancestors.descendant_id
INNER JOIN people AS person ON person.id = parent_link.person_id
INNER JOIN `groups` AS parent_group ON parent_group.id = parent_link.group_id
WHERE parent_link.group_id <> child_link.group_id
  AND (parent_group.personal_owner_id IS NULL
    OR person.user_id IS NULL
    OR parent_group.personal_owner_id <> person.user_id);
