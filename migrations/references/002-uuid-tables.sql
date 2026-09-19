-- Target schema for references-uuid-migrate.mjs; it creates staging tables and retains originals.
CREATE TABLE `cities` (
  `id` Uuid NOT NULL,
  `name` Utf8 NOT NULL,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `teams` (
  `id` Uuid NOT NULL,
  `name` Utf8 NOT NULL,
  `cityId` Uuid NOT NULL,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `matches` (
  `id` Uint64 NOT NULL,
  `tournamentId` Uint64 NOT NULL,
  `stageId` Uint64,
  `matchDate` Timestamp NOT NULL,
  `cityId` Uuid NOT NULL,
  `homeSlotId` Uint64,
  `awaySlotId` Uint64,
  `homeTeamId` Uuid,
  `awayTeamId` Uuid,
  `homeScore` Int32,
  `awayScore` Int32,
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
  `teamId` Uuid,
  `seed` Uint32,
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
  `resolvedTeamId` Uuid,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);
