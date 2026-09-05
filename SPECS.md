# Memties — V1 Specification

## 1. Product vision

Memties is an open-source application for maintaining a structured memory of human relationships.

It is not a social network.

Users do not communicate with each other through Memties.

The application exists to help users remember:

* who people are;
* how they know them;
* which contexts they belong to;
* past interactions;
* things that need follow-up;
* shared knowledge about contacts inside a team or group.

Memties must work for both professional and personal use.

Typical professional use case:

A project manager collaborates with many organizations. Each organization has multiple contacts: developers, financial managers, HR, directors, administrators, etc.

The user must be able to quickly answer:

* Who is this person?
* Which organization or project are they related to?
* When did we last interact?
* What did we discuss?
* What do we need to follow up on?
* What does my team already know about this person?

Typical personal use case:

A user wants to remember interactions with friends, family, associations, communities, or other people in their life.

---

# 2. Core concepts

The main domain concepts are:

* User
* Group
* Person
* Entry
* Reminder

An Entry is the central historical object.

An Entry may represent:

* a meeting summary;
* a phone call;
* a conversation;
* an email summary;
* a note;
* an observation;
* any other piece of contextual information.

An Entry may have zero, one, or multiple Persons attached.

If an Entry has no Person attached, it behaves like a normal note.

---

# 3. Users

A User is an authenticated Memties account.

Users can:

* create groups;
* create people;
* create entries;
* create reminders;
* share groups with other Memties users;
* access groups shared with them;
* use MCP to interact with their Memties data.

Users are always represented internally by the same user model regardless of authentication method.

---

# 4. Authentication

V1 architecture must allow multiple authentication providers.

Target providers:

* local authentication;
* LDAP;
* SAML.

Local authentication should be available by default.

LDAP and SAML must integrate into the same internal User model.

Authentication provider details must not leak into normal application business logic.

The implementation should allow additional providers later without redesigning the User model.

---

# 5. Groups

Groups organize people and entries.

Groups form a recursive tree.

A Group may have:

* a name;
* an optional description;
* an optional parent group;
* members/users with access to the group.

There must be no artificial nesting depth limit in application logic.

Example:

```text
Professional
└── Project Alpha
    ├── Laboratory A
    │   ├── Technical
    │   ├── Finance
    │   └── Management
    └── Laboratory B
        ├── Technical
        └── HR
```

Groups are both:

1. organizational contexts;
2. sharing/security boundaries.

---

# 6. Personal group

Every User must have a default special group called:

```text
Personal
```

The displayed name may eventually be localized.

This group is a protected private space.

Rules:

* created automatically for every user;
* cannot be deleted;
* cannot be shared;
* other users cannot become members;
* entries located inside this group are always private;
* its privacy cannot be overridden;
* moving an Entry outside of Personal is required before it can become shared.

Personal behaves like a private vault.

The implementation must never expose Personal content through group sharing, recursive access, MCP, search, API responses, or indirect relationships.

---

# 7. Recursive group behavior

When a user selects a Group, the UI must operate recursively over its descendants.

Example:

```text
Professional
├── Project A
│   ├── Technical
│   └── Finance
└── Project B
```

Selecting `Professional` should show Persons belonging to:

* Professional;
* Project A;
* Technical;
* Finance;
* Project B;
* any deeper descendants.

Selecting `Project A` should only show Persons belonging to Project A and its descendants.

Selecting `Technical` should only show Persons attached to Technical and its descendants.

A Person must appear only once in the resulting list even if attached to multiple matching groups.

---

# 8. Group sharing

Normal Groups can be shared with other Memties Users.

Users may have roles on a Group.

At minimum:

* Owner
* Editor
* Viewer

Exact naming may change if needed.

Expected semantics:

### Owner

Can:

* read;
* modify;
* manage people;
* manage entries;
* manage reminders;
* manage group settings;
* invite/remove members;
* manage permissions.

### Editor

Can:

* read;
* create and edit relevant shared content;
* attach people;
* create entries;
* manage reminders where permitted.

Should not manage ownership or destructive group-level security settings unless explicitly allowed.

### Viewer

Can:

* read shared group content.

Cannot modify shared content.

Permission inheritance through child groups must be implemented predictably.

A user with access to a parent group should normally have equivalent or compatible access to its descendants unless a future specification explicitly introduces exceptions.

Do not invent complex deny/override permission rules in V1.

---

# 9. Persons

A Person represents a human contact.

A Person is not necessarily a Memties User.

Possible fields:

* first name;
* last name;
* display name;
* optional nickname;
* optional email;
* optional phone;
* optional organization;
* optional job title / role;
* optional general notes;
* timestamps.

The exact set of optional contact fields may evolve during implementation if needed.

A Person may belong to zero or multiple Groups.

Example:

Thomas may belong to:

```text
Professional > Project Alpha > Laboratory A > Technical
Professional > Project Beta > Architecture
```

Thomas must remain one Person, not duplicated once per Group.

---

# 10. Person visibility

A Person is visible to a User when the User has permission to access at least one Group containing that Person, or when the Person exists in the User's private Personal context.

Visibility rules must prevent unrelated groups from leaking information.

A shared Person does not automatically expose every Entry attached to that Person.

Entry visibility is evaluated independently.

This rule is critical.

Example:

Thomas belongs to a shared professional group.

Alice has:

* one shared meeting Entry with Thomas;
* one private Personal Entry with Thomas.

Another group member may see Thomas and the shared meeting.

They must never know that Alice's private Entry exists.

---

# 11. Entries

Entry is the central content object.

An Entry contains at minimum:

* title;
* content/body;
* date/time;
* creator;
* owning Group;
* zero or more linked Persons;
* created timestamp;
* updated timestamp.

An Entry may represent either a relationship interaction or a standalone note.

Examples:

### Interaction

```text
Title: Budget meeting
People:
- Marie Dupont
- Thomas Martin

Body:
Discussed the remaining 2026 budget allocation...
```

### Standalone note

```text
Title: Things to prepare for next steering committee

People:
none

Body:
Prepare updated milestone table...
```

Both are Entries.

Do not create separate incompatible systems for notes and interactions.

---

# 12. Entry ownership and group context

Every Entry belongs to exactly one Group.

The Group defines its context and its potential sharing boundary.

Example:

```text
Professional > Project Alpha > Laboratory A > Finance
```

An Entry created while this Group is selected belongs to that Group by default.

The current Group should therefore be automatically selected when creating an Entry from the group interface.

The user may move an Entry to another Group if they have sufficient permissions.

Moving an Entry may change who can access it and must therefore be treated as a security-sensitive operation.

---

# 13. Entry privacy

Entries inside the Personal group are always private.

Entries inside normal Groups may be shared according to the Group's access rules.

V1 should keep the model simple:

* Personal Group => forced private;
* normal shared Group => visible according to Group permissions;
* normal non-shared Group => visible only to its owner/members.

Do not add arbitrary per-user ACL lists to individual Entries in V1 unless implementation requires it for a clearly identified product need.

A private Entry must not become visible merely because:

* one of its Persons is shared;
* a Person belongs to another shared Group;
* another user searches for the Person;
* an MCP tool queries that Person;
* a parent Group is shared.

---

# 14. Multi-person Entries

An Entry may reference multiple Persons.

This is required for meeting summaries.

Example:

```text
Entry:
Quarterly project meeting

Participants:
- Alice
- Thomas
- Marie
- Paul
```

The same Entry must appear in the relevant history of every attached Person.

Do not duplicate the Entry once per Person.

The relationship is many-to-many.

---

# 15. Person history

When viewing a Person, Memties must show their related Entries as a chronological timeline.

The timeline should support filtering.

At minimum, useful filters should include:

* Group/context;
* date or date range;
* linked participant;
* text search.

Additional filters such as Entry type may be introduced later if useful.

The UI must support a Person with hundreds of Entries without becoming unusable.

Pagination or incremental loading should be used when necessary.

---

# 16. Group context as filtering

Because an Entry belongs to a Group, its Group acts naturally as contextual metadata.

Example:

Thomas has 200 Entries.

A user viewing Thomas may filter to:

```text
Project Alpha > Laboratory A
```

and see only Entries belonging to that Group or its relevant descendant scope.

Group references must remain relational database references.

Do not store group context only as copied text.

Renaming a Group must not break historical Entry filtering.

---

# 17. Moving Entries

Users must be able to move an Entry between Groups when authorized.

Important example:

An Entry exists in:

```text
Personal
```

The User wants to share it.

They cannot directly make it public/shared while it remains in Personal.

They must move it to a normal Group.

The UI should make the resulting visibility change clear.

Backend authorization must validate both:

* permission to access/move the existing Entry;
* permission to create/place content in the destination Group.

---

# 18. Reminders

Memties must support reminders.

A Reminder may be attached to:

* an Entry;
* optionally a Person if useful in implementation.

Prefer linking reminders to Entries where possible because the Entry provides context.

A Reminder should have at minimum:

* title or text;
* due date/time;
* status;
* creator;
* timestamps.

Possible statuses:

* pending;
* completed.

Example:

```text
Entry:
Meeting with Thomas

Reminder:
Ask Thomas for the architecture document

Due:
2026-09-14
```

Recurring reminders are not required for the initial V1 unless they can be added cleanly without expanding scope significantly.

---

# 19. Calendar integration

The data model and reminder system should not prevent future calendar integration.

Potential future targets include:

* ICS export;
* CalDAV;
* Google Calendar;
* Microsoft calendar systems.

A complete bidirectional calendar synchronization is not required for initial V1.

Do not build a complex calendar synchronization engine unless explicitly requested.

It should however be possible to add calendar integration later without redesigning reminders from scratch.

---

# 20. Main UI layout

Desktop is the primary V1 interface.

The main application layout should roughly follow:

```text
┌──────────────────────────┬─────────────────────────────────────────────┐
│                          │                                             │
│       GROUP TREE         │               CONTENT                       │
│                          │                                             │
│       ~1/3 width         │               ~2/3 width                    │
│                          │                                             │
└──────────────────────────┴─────────────────────────────────────────────┘
```

Left side:

* recursive group tree;
* current selected group;
* ability to expand/collapse groups;
* ability to create/manage groups when authorized.

Right side:

* people in the selected recursive scope;
* selected Person details;
* Entry timeline;
* creation actions.

Exact visual implementation may evolve based on usability.

Do not overdesign V1.

---

# 21. Person list

When a Group is selected, the right side should display all Persons belonging to that Group or any descendant Group.

Each Person should have enough information for quick recognition.

Examples:

* name;
* organization;
* role/job title;
* possibly parent/group context.

Search should be available when the list becomes large.

Clicking a Person opens their detailed relationship view.

---

# 22. Person detail view

The Person detail view should expose:

* identity/contact information;
* Groups they belong to;
* useful role/context information;
* chronological Entry history;
* filters;
* open reminders related to that Person where appropriate;
* action to add a new Entry involving that Person.

Creating an Entry from a Person should preselect that Person.

If a Group context is currently active, it should also preselect that Group as the Entry's owning Group.

---

# 23. Entry creation UX

Creating an Entry should be fast.

At minimum:

* title;
* body;
* date/time defaulting to now;
* owning Group defaulting to current context;
* linked Persons;
* optional Reminder.

Date/time must be editable.

Person selection should support multiple Persons.

Users should not need to navigate through unnecessary forms for common interaction logging.

---

# 24. Search

V1 should provide useful search capabilities.

Users should be able to search for:

* Persons;
* Entries.

Search must respect permissions.

Search must never reveal:

* titles;
* snippets;
* counts;
* Person relationships;
* existence of private Entries;

when the User does not have permission to view the corresponding content.

---

# 25. MCP

MCP is a first-class Memties interface.

The goal is to allow AI assistants to use Memties as structured relationship memory.

Example user requests to an AI:

```text
Who is our finance contact at Laboratory B?
```

```text
What did I last discuss with Thomas?
```

```text
I had a call with Thomas and Marie today.
We discussed the API migration.
Thomas will send the document next week.
Add this to Memties.
```

```text
Prepare me for my meeting with Laboratory A.
```

The MCP layer must use the same application services and authorization rules as the normal API.

---

# 26. Initial MCP capabilities

Exact tool names may be adjusted during implementation, but V1 should cover capabilities equivalent to:

* search people;
* get person details;
* create person;
* list groups;
* create Entry;
* retrieve Entries;
* search Entries;
* create Reminder;
* list Reminders;
* mark Reminder complete.

MCP should also be able to determine valid Groups when creating an Entry.

The AI may select an appropriate Group based on user intent and available context.

If multiple plausible destination Groups create a meaningful privacy/sharing ambiguity, the AI should ask the user instead of guessing.

---

# 27. MCP privacy

MCP must never bypass normal permissions.

The AI can only access information the authenticated User could access through the application.

Special care must be taken with Personal.

Personal data must never be exposed to another User merely because:

* they share a Person;
* they share another Group;
* the Person appears in multiple Groups;
* the AI performs a broad search.

MCP write operations must identify the authenticated creator.

---

# 28. MCP auditability

Entries created through MCP are normal Memties Entries.

They should not use a separate storage model.

The system should retain enough metadata to know that an Entry was created through MCP if this can be done simply.

Possible source values:

* web;
* MCP.

This metadata is useful for diagnostics and auditability.

Do not build an excessive audit subsystem in V1.

---

# 29. Sharing use case

A major target use case is collaborative professional knowledge.

Example:

A project is shared by 15 laboratories.

Memties Group tree:

```text
Project
├── Laboratory A
│   ├── Technical
│   ├── HR
│   ├── Finance
│   └── Direction
├── Laboratory B
│   ├── Technical
│   └── Finance
...
```

Multiple project members can share this structure.

They can collectively maintain:

* who each contact is;
* their role;
* recent interactions;
* meeting summaries;
* follow-ups.

This shared knowledge prevents relationship context from remaining only in one person's memory.

---

# 30. Personal use case

Memties must remain usable outside professional contexts.

Example:

```text
Personal
├── Friends
├── Family
└── Roleplaying
```

However, the system Personal group itself is the protected private vault.

If the implementation allows children under Personal, they must inherit the same non-shareable privacy behavior.

A future design may distinguish the system vault from user-created personal organization if needed.

Do not weaken the privacy guarantee for convenience.

---

# 31. Data consistency

The system should avoid accidental duplication of Persons.

V1 does not need advanced automatic identity resolution.

The UI may help users detect likely duplicates using obvious fields such as:

* name;
* email.

Do not automatically merge people without explicit user action.

---

# 32. Deletion

Deletion behavior must be conservative.

Deleting a Person must not silently destroy shared historical Entries.

Because Entries are independent objects with many-to-many Person links, deleting or removing a Person must be designed carefully.

Prefer soft deletion or unlinking when necessary to preserve shared history.

If deletion semantics become ambiguous during implementation, ask before implementing destructive behavior.

Groups with shared data must not be recursively destroyed without clear confirmation and authorization.

---

# 33. Self-hosting

Memties is open source and should remain easy to self-host.

The V1 architecture should support a straightforward deployment using:

* application;
* MySQL;
* SMTP configuration.

Avoid infrastructure that makes self-hosting unnecessarily complex.

A Docker-based deployment may be provided.

---

# 34. Hosted version

A hosted Memties service is planned.

Expected positioning:

* self-hosted version: free;
* hosted version: low-cost paid service.

The open-source and hosted versions should use the same core application.

Do not intentionally cripple the self-hosted version to create artificial paid features.

Hosted users primarily pay for convenience:

* hosting;
* backups;
* maintenance;
* updates.

Billing is not necessarily required in the first implementation milestone unless explicitly requested.

---

# 35. Localization

Memties is intended for a broad audience.

The architecture should not unnecessarily prevent localization.

The initial UI may be implemented in English unless otherwise requested.

Avoid hardcoding domain values whose display text will later need translation when a simple enum + translation mapping would be cleaner.

Do not build a large translation system unless needed for V1.

---

# 36. Mobile and responsive behavior

Desktop is the main V1 target.

The interface should still remain usable on smaller screens.

A native mobile application is out of scope.

PWA behavior may be added later.

Do not build a separate mobile interface unless explicitly requested.

---

# 37. Out of scope for initial V1

Unless explicitly requested during implementation, V1 does not require:

* social networking;
* messaging between users;
* feeds;
* likes/reactions;
* relationship scoring;
* AI-generated relationship quality metrics;
* LinkedIn integration;
* automatic email ingestion;
* automatic meeting transcription;
* advanced analytics;
* native mobile apps;
* full calendar synchronization;
* complex billing;
* microservices;
* GraphQL;
* real-time collaborative editing.

---

# 38. Security principles

Memties stores potentially sensitive personal and professional information.

Security and privacy are core product requirements.

The backend must enforce every permission.

Frontend hiding is never considered authorization.

The implementation must pay special attention to:

* recursive group access;
* shared Persons with private Entries;
* group movement of Entries;
* MCP queries;
* search;
* deletion;
* LDAP/SAML identity mapping;
* session security.

When a privacy rule is ambiguous, implementation must stop and ask rather than choosing a permissive behavior.

---

# 39. V1 success criteria

A successful V1 must allow a User to:

1. authenticate;
2. see their Personal group;
3. create nested Groups;
4. share normal Groups with another Memties User;
5. assign permissions;
6. create Persons;
7. attach Persons to multiple Groups;
8. select a Group and recursively see its Persons;
9. open a Person;
10. see their Entry history;
11. create an Entry linked to zero, one, or multiple Persons;
12. create a meeting summary involving multiple Persons;
13. create a standalone note;
14. keep Personal Entries private;
15. move an Entry from Personal into a normal Group;
16. filter a Person's history by Group/context;
17. create and complete Reminders;
18. search People and Entries;
19. access Memties through MCP;
20. create/read relevant Entries through MCP while respecting permissions.

---

# 40. Implementation strategy

Do not attempt to implement every subsystem simultaneously.

Prefer incremental functional milestones.

Suggested order:

1. database and base application;
2. local authentication;
3. Groups and recursive tree;
4. Persons;
5. Entries;
6. Person timeline;
7. Personal privacy rules;
8. group sharing and permissions;
9. Reminders;
10. search;
11. MCP;
12. LDAP/SAML;
13. polish;
14. testing and hardening.

After a meaningful user-facing milestone, the project owner may be asked to validate the behavior before dependent features are built.

The implementation order may be adjusted if a different sequence is technically cleaner.

---

# 41. Product rule of thumb

When uncertain about a feature, preserve the following principles:

**A Person represents a human.**

**A Group represents context and access.**

**An Entry represents memory.**

**A Reminder represents something that should not be forgotten.**

**Personal represents a private vault.**

**MCP is another interface to the same Memties data, never a privileged bypass.**

Memties should remain simple enough that users understand where information lives and who can see it.
