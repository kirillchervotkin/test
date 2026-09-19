-- Справочники используют безопасные числовые ID в API и Uint64 в YDB.
CREATE TABLE `cities` (
  `id` Uint64 NOT NULL,
  `name` Utf8 NOT NULL,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);
CREATE TABLE `teams` (
  `id` Uint64 NOT NULL,
  `name` Utf8 NOT NULL,
  `cityId` Uint64 NOT NULL,
  `createdAt` Timestamp NOT NULL,
  `updatedAt` Timestamp NOT NULL,
  PRIMARY KEY (`id`)
);
