// interfaces/assignmentService.interface.ts
import { CreateAssignmentDto } from '../dto/createAssignment.dto.js';
import { UpdateAssignmentDto } from '../dto/updateAssignment.dto.js';
import { AssignmentResponseDto } from '../dto/assignmentResponse.dto.js';

export interface AssignmentService {
  create(
    matchId: number,
    createAssignmentDto: CreateAssignmentDto,
  ): AssignmentResponseDto;
  findAllByMatch(matchId: number): AssignmentResponseDto[];
  findOne(id: number): AssignmentResponseDto;
  remove(id: number): { message: string };
  update(
    id: number,
    updateAssignmentDto: UpdateAssignmentDto,
  ): AssignmentResponseDto;
}
