import { CreateAutoSelectionRuleDto } from '../dto/createAutoSelectionRule.dto.js';
import { UpdateAutoSelectionRuleDto } from '../dto/updateAutoSelectionRule.dto.js';
import { AutoSelectionRuleResponseDto } from '../dto/autoSelectionRuleResponse.dto.js';

export interface AutoSelectionRuleService {
  create(
    tournamentId: number,
    createDto: CreateAutoSelectionRuleDto,
  ): AutoSelectionRuleResponseDto;

  findAll(tournamentId: number): AutoSelectionRuleResponseDto[];

  findOne(tournamentId: number, id: number): AutoSelectionRuleResponseDto;

  update(
    tournamentId: number,
    id: number,
    updateDto: UpdateAutoSelectionRuleDto,
  ): AutoSelectionRuleResponseDto;

  remove(tournamentId: number, id: number): { message: string };
}
