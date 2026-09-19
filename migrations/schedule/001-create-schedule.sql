-- Fresh installation only. Existing tables require an inspected migration; never DROP data.
CREATE TABLE `tournaments` (
  `id` Uint64 NOT NULL,
  `name` Utf8 NOT NULL,
  `season` Utf8 NOT NULL,
  `type` Utf8 NOT NULL,
  `startDate` Date NOT NULL,
  `endDate` Date NOT NULL,
  `templateId` Uint64,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `stages` (
  `id` Uint64 NOT NULL,
  `tournamentId` Uint64 NOT NULL,
  `parentStageId` Uint64,
  `type` Utf8 NOT NULL,
  `format` Utf8 NOT NULL,
  `name` Utf8 NOT NULL,
  `sortOrder` Uint32 NOT NULL,
  `settings` Json,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `tournament_team_slots` (
  `id` Uint64 NOT NULL,
  `tournamentId` Uint64 NOT NULL,
  `stageId` Uint64 NOT NULL,
  `groupName` Utf8,
  `slotName` Utf8 NOT NULL,
  `teamId` Uint64,
  `seed` Uint32,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `matches` (
  `id` Uint64 NOT NULL,
  `tournamentId` Uint64 NOT NULL,
  `stageId` Uint64,
  `matchDate` Timestamp NOT NULL,
  `cityId` Uint64 NOT NULL,
  `homeSlotId` Uint64,
  `awaySlotId` Uint64,
  `homeTeamId` Uint64,
  `awayTeamId` Uint64,
  `homeScore` Int32,
  `awayScore` Int32,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `bracket_slots` (
  `id` Uint64 NOT NULL,
  `matchId` Uint64 NOT NULL,
  `side` Utf8 NOT NULL,
  `sourceType` Utf8 NOT NULL,
  `sourceStageId` Uint64,
  `sourceGroupName` Utf8,
  `sourcePosition` Uint32,
  `sourceMatchId` Uint64,
  `resolvedTeamId` Uint64,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `tournament_templates` (
  `id` Uint64 NOT NULL,
  `name` Utf8 NOT NULL,
  `description` Utf8,
  `version` Uint32 NOT NULL,
  `isActive` Bool NOT NULL,
  `schema` Json NOT NULL,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);

