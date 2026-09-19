import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CityService } from '../city/interfaces/cityService.interface.js';
import { CITY_SERVICE } from '../city/tokens.js';
import type { TeamService } from '../team/interfaces/teamService.interface.js';
import { TEAM_SERVICE } from '../team/tokens.js';
import type {
  BracketSlot,
  Match,
  Tables,
} from './entities/types/schedule.types.js';
import { ScheduleMapper } from './mappers/schedule.mapper.js';
import type { ScheduleStore } from './repository/schedule.repository.js';

@Injectable()
export class ScheduleIntegrityService {
  constructor(
    @Inject(TEAM_SERVICE) private readonly teams: TeamService,
    @Inject(CITY_SERVICE) private readonly cities: CityService,
  ) {}
  async external(kind: 'team' | 'city', id: string): Promise<void> {
    await ScheduleMapper.id(id);
    const numeric = Number(id);
    if (!Number.isSafeInteger(numeric))
      throw new BadRequestException(
        'Существующие справочники принимают ID не больше Number.MAX_SAFE_INTEGER',
      );
    try {
      if (kind === 'team') await this.teams.findOne(numeric);
      else await this.cities.findOne(numeric);
    } catch {
      throw new NotFoundException(
        kind === 'team' ? 'Команда не найдена' : 'Город не найден',
      );
    }
  }
  async owned<K extends 'stages' | 'matches' | 'tournament_team_slots'>(
    db: ScheduleStore,
    table: K,
    id: string,
    tournamentId: string,
  ): Promise<Tables[K]> {
    const value = await db.get(table, await ScheduleMapper.id(id));
    if (value.tournamentId !== tournamentId)
      throw new BadRequestException('Сущность принадлежит другому турниру');
    return value;
  }
  async match(db: ScheduleStore, m: Match): Promise<void> {
    const tournament = await db.get('tournaments', m.tournamentId);
    const day = new Date(m.matchDate).toISOString().slice(0, 10);
    if (day < tournament.startDate || day > tournament.endDate)
      throw new BadRequestException('Дата матча выходит за даты турнира');
    await this.external('city', m.cityId);
    if (m.stageId) await this.owned(db, 'stages', m.stageId, m.tournamentId);
    for (const side of ['home', 'away'] as const) {
      const slotId = m[`${side}SlotId`];
      if (slotId) {
        const slot = await this.owned(
          db,
          'tournament_team_slots',
          slotId,
          m.tournamentId,
        );
        if (slot.stageId !== m.stageId)
          throw new BadRequestException('Слот не принадлежит этапу матча');
        m[`${side}TeamId`] = slot.teamId;
      }
      const team = m[`${side}TeamId`];
      if (team) await this.external('team', team);
    }
    if (
      (m.homeSlotId && m.homeSlotId === m.awaySlotId) ||
      (m.homeTeamId && m.homeTeamId === m.awayTeamId)
    )
      throw new BadRequestException('Матч против самого себя недопустим');
    if ((m.homeScore === null) !== (m.awayScore === null))
      throw new BadRequestException(
        'Оба счёта должны быть заполнены одновременно',
      );
    if (m.homeScore !== null && (!m.homeTeamId || !m.awayTeamId))
      throw new BadRequestException(
        'Перед вводом результата назначьте команды',
      );
  }
  async bracket(db: ScheduleStore, b: BracketSlot): Promise<void> {
    const target = await db.get('matches', b.matchId);
    if (!target.stageId)
      throw new BadRequestException('Для слота плей-офф нужен этап матча');
    if (b.sourceType === 'GROUP') {
      if (!b.sourceStageId || !b.sourcePosition || b.sourceMatchId)
        throw new BadRequestException(
          'GROUP требует sourceStageId и sourcePosition без sourceMatchId',
        );
      let source = await this.owned(
        db,
        'stages',
        b.sourceStageId,
        target.tournamentId,
      );
      if (b.sourceGroupName) {
        const children = await db.list('stages', { parentStageId: source.id });
        const found = children.filter((s) => s.name === b.sourceGroupName);
        if (found.length !== 1)
          throw new BadRequestException(
            'Группа не найдена или имя неоднозначно',
          );
        source = found[0];
      }
      if (source.format !== 'ROUND_ROBIN' || source.id === target.stageId)
        throw new BadRequestException(
          'Источник должен быть другим круговым этапом',
        );
    } else {
      if (
        !b.sourceMatchId ||
        b.sourceStageId ||
        b.sourcePosition ||
        b.sourceGroupName
      )
        throw new BadRequestException(
          'WINNER/LOSER требует только sourceMatchId',
        );
      await this.owned(db, 'matches', b.sourceMatchId, target.tournamentId);
      const rules = await db.list('bracket_slots');
      const stack = [b.sourceMatchId],
        seen = new Set<string>();
      while (stack.length) {
        const id = stack.pop()!;
        if (id === b.matchId)
          throw new ConflictException('Циклическая зависимость матчей');
        if (seen.has(id)) continue;
        seen.add(id);
        for (const r of rules)
          if (r.matchId === id && r.sourceMatchId) stack.push(r.sourceMatchId);
      }
    }
    if (
      (
        await db.list('bracket_slots', { matchId: b.matchId, side: b.side })
      ).some((x) => x.id !== b.id)
    )
      throw new ConflictException('Для стороны матча уже задан источник');
  }
}
