// src/matches/entities/match.schema.ts

import {
  ydbTable,
  uuid,
  integer,
  uint32,
  timestamp,
  index,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const matches = ydbTable(
  'matches',
  {
    // Первичный ключ — одиночный UUID
    id: uuid('id').primaryKey().notNull(),

    // Турнир, к которому относится матч. Обязательное поле.
    tournamentId: uuid('tournament_id').notNull(),

    // Этап (группа или раунд). Обязательное поле.
    stageId: uuid('stage_id').notNull(),

    // Номер тура. Заполняется только для матчей кругового этапа
    // (ROUND_ROBIN). Для плей-офф (ELIMINATION) — NULL.
    tourNumber: uint32('tour_number'),

    // Дата и время матча. Обязательное поле.
    matchDate: timestamp('match_date').notNull(),

    // Город проведения. Обязательное поле.
    cityId: uuid('city_id').notNull(),

    // Домашняя команда. NULL для матчей плей-офф, участники
    // которых определяются по результатам групп.
    homeTeamId: uuid('home_team_id'),

    // Гостевая команда. NULL по той же причине.
    awayTeamId: uuid('away_team_id'),

    // Голы хозяев. NULL, пока матч не сыгран.
    homeScore: integer('home_score'),

    // Голы гостей. NULL, пока матч не сыгран.
    awayScore: integer('away_score'),
  },
  (table) => [
    // Все матчи турнира.
    index('idx_matches_tournament').on(table.tournamentId),

    // Все матчи этапа (группы или раунда).
    index('idx_matches_stage').on(table.stageId),

    // Матчи за период (диапазон дат).
    index('idx_matches_date').on(table.matchDate),

    // Матчи города.
    index('idx_matches_city').on(table.cityId),

    // Матчи команды (дома).
    index('idx_matches_home_team').on(table.homeTeamId),

    // Матчи команды (в гостях).
    index('idx_matches_away_team').on(table.awayTeamId),

    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
