// interfaces/assignmentService.interface.ts
import { CreateAssignmentDto } from '../dto/createAssignment.dto.js';
import { UpdateAssignmentDto } from '../dto/updateAssignment.dto.js';
import { AssignmentResponseDto } from '../dto/assignmentResponse.dto.js';

export interface AssignmentService {
  create(
    matchId: string,
    createAssignmentDto: CreateAssignmentDto,
  ): Promise<AssignmentResponseDto>;
  findAllByMatch(matchId: string): Promise<AssignmentResponseDto[]>;
  findOne(id: number): Promise<AssignmentResponseDto>;
  remove(id: number): Promise<{ message: string }>;
  update(
    id: number,
    updateAssignmentDto: UpdateAssignmentDto,
  ): Promise<AssignmentResponseDto>;
}
