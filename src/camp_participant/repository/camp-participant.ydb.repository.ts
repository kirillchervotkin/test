import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, asc, max, inArray } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import {
  YdbUniqueConstraintViolationError,
  YdbDrizzleDatabase,
} from '@ydbjs/drizzle-adapter';
import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { campParticipant } from '../entities/camp-participant.schema.js';
import { trainingCamps } from '../../training_camp/entities/training-camp.schema.js';
import { users } from '../../user/entities/user.schema.js';
import {
  CampParticipant,
  CreateCampParticipantData,
  CampParticipantWithUser, // 👈 импортируем тип из types
} from '../entities/types/camp-participant.types.js';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';

type DrizzleDb = YdbDrizzleDatabase;
type QueryExecutor = Pick<DrizzleDb, 'select' | 'insert' | 'update' | 'delete'>;

@Injectable()
export class CampParticipantYdbRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // === Проверка на дубликат ===
  private isDuplicateError(error: unknown): boolean {
    if (error instanceof YdbUniqueConstraintViolationError) {
      return true;
    }
    if (error instanceof YDBError && (error.code as number) === 400120) {
      return true;
    }
    if (
      error instanceof Error &&
      'cause' in error &&
      error.cause instanceof YDBError &&
      (error.cause.code as number) === 400120
    ) {
      return true;
    }
    return false;
  }

  // === Вспомогательные методы ===
  private async getNextBib(tx: QueryExecutor, campId: string): Promise<number> {
    const result = await tx
      .select({ maxBib: max(campParticipant.bib) })
      .from(campParticipant)
      .where(eq(campParticipant.campId, campId));
    const maxBib = (result[0] as { maxBib: number | null })?.maxBib ?? 0;
    return maxBib + 1;
  }

  private async ensureCampExists(
    tx: QueryExecutor,
    campId: string,
  ): Promise<void> {
    const camp = await tx
      .select({ id: trainingCamps.id })
      .from(trainingCamps)
      .where(eq(trainingCamps.id, campId))
      .limit(1);
    if (!camp || camp.length === 0) {
      throw new NotFoundException(`Training camp with id ${campId} not found`);
    }
  }

  private async ensureUserExists(
    tx: QueryExecutor,
    userId: string,
  ): Promise<void> {
    const user = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || user.length === 0) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
  }

  private handleDbError(
    error: unknown,
    context?: { campId?: string; userId?: string; bib?: number },
  ): never {
    if (this.isDuplicateError(error)) {
      const fields = [];
      if (context?.campId)
        fields.push({ dbField: 'camp_id', value: context.campId });
      if (context?.bib !== undefined)
        fields.push({ dbField: 'bib', value: context.bib });
      if (context?.userId)
        fields.push({ dbField: 'user_id', value: context.userId });
      if (fields.length === 0) fields.push({ dbField: 'unknown' });

      throw new DbUniqueViolationException(fields, 'idx_camp_bib_unique');
    }
    throw error;
  }

  private async recalculateBibs(
    tx: QueryExecutor,
    campId: string,
  ): Promise<void> {
    const participants = (await tx
      .select({
        userId: campParticipant.userId,
        bib: campParticipant.bib,
      })
      .from(campParticipant)
      .where(eq(campParticipant.campId, campId))
      .orderBy(asc(campParticipant.bib))) as { userId: string; bib: number }[];

    for (let i = 0; i < participants.length; i++) {
      const newBib = i + 1;
      if (participants[i].bib !== newBib) {
        await tx
          .update(campParticipant)
          .set({ bib: newBib })
          .where(
            and(
              eq(campParticipant.campId, campId),
              eq(campParticipant.userId, participants[i].userId),
            ),
          );
      }
    }
  }

  // === CREATE (одиночное добавление) ===
  async create(data: CreateCampParticipantData): Promise<CampParticipant> {
    const { campId, userId } = data;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.transaction(async (tx) => {
          await this.ensureCampExists(tx, campId);
          await this.ensureUserExists(tx, userId);

          const nextBib = await this.getNextBib(tx, campId);

          const inserted = (await tx
            .insert(campParticipant)
            .values({
              campId,
              userId,
              bib: nextBib,
            })
            .returning({
              campId: campParticipant.campId,
              userId: campParticipant.userId,
              bib: campParticipant.bib,
            })) as CampParticipant[];

          const [newRecord] = inserted;
          if (!newRecord) throw new Error('Failed to create participant');
          return newRecord;
        });
      } catch (error) {
        if (this.isDuplicateError(error)) {
          if (attempt === 2) {
            const nextBib = await this.getNextBib(this.db, campId);
            throw new DbUniqueViolationException(
              [
                { dbField: 'camp_id', value: campId },
                { dbField: 'bib', value: nextBib },
              ],
              'idx_camp_bib_unique',
            );
          }
          continue;
        }
        this.handleDbError(error, { campId, userId });
      }
    }

    throw new DbUniqueViolationException(
      [
        { dbField: 'camp_id', value: campId },
        { dbField: 'bib', value: 0 },
      ],
      'idx_camp_bib_unique',
    );
  }

  // === BULK ADD (пакетное добавление) ===
  async bulkAddParticipants(
    campId: string,
    userIds: string[],
  ): Promise<CampParticipant[]> {
    if (userIds.length === 0) return [];

    return await this.db
      .transaction(async (tx) => {
        await this.ensureCampExists(tx, campId);

        const existingUsers = await tx
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, userIds));
        const existingUserIds = new Set(
          (existingUsers as { id: string }[]).map((u) => u.id),
        );
        const missingIds = userIds.filter((id) => !existingUserIds.has(id));
        if (missingIds.length > 0) {
          throw new NotFoundException(
            `Users with ids ${missingIds.join(', ')} not found`,
          );
        }

        const existingParticipants = await tx
          .select({ userId: campParticipant.userId })
          .from(campParticipant)
          .where(eq(campParticipant.campId, campId));
        const alreadyParticipantIds = new Set(
          (existingParticipants as { userId: string }[]).map((p) => p.userId),
        );

        const toInsertUserIds = userIds.filter(
          (id) => !alreadyParticipantIds.has(id),
        );

        if (toInsertUserIds.length === 0) return [];

        const maxBibResult = await tx
          .select({ maxBib: max(campParticipant.bib) })
          .from(campParticipant)
          .where(eq(campParticipant.campId, campId));
        const currentMaxBib =
          (maxBibResult[0] as { maxBib: number | null })?.maxBib ?? 0;

        const values = toInsertUserIds.map((userId, index) => ({
          campId,
          userId,
          bib: currentMaxBib + index + 1,
        }));

        const inserted = (await tx
          .insert(campParticipant)
          .values(values)
          .returning({
            campId: campParticipant.campId,
            userId: campParticipant.userId,
            bib: campParticipant.bib,
          })) as CampParticipant[];

        return inserted;
      })
      .catch((error) => {
        this.handleDbError(error, { campId });
      });
  }

  // === BULK REMOVE (пакетное удаление с пересчётом bib) ===
  async bulkRemoveParticipants(
    campId: string,
    userIds: string[],
  ): Promise<CampParticipant[]> {
    if (userIds.length === 0) return [];

    return await this.db
      .transaction(async (tx) => {
        const removed = (await tx
          .delete(campParticipant)
          .where(
            and(
              eq(campParticipant.campId, campId),
              inArray(campParticipant.userId, userIds),
            ),
          )
          .returning({
            campId: campParticipant.campId,
            userId: campParticipant.userId,
            bib: campParticipant.bib,
          })) as CampParticipant[];

        await this.recalculateBibs(tx, campId);
        return removed;
      })
      .catch((error) => {
        this.handleDbError(error, { campId });
      });
  }

  // === FIND BY COMPOSITE KEY ===
  async findByComposite(
    campId: string,
    userId: string,
  ): Promise<CampParticipant | null> {
    const result = await this.db
      .select()
      .from(campParticipant)
      .where(
        and(
          eq(campParticipant.campId, campId),
          eq(campParticipant.userId, userId),
        ),
      )
      .limit(1);
    return (result[0] as CampParticipant) || null;
  }

  // === UPDATE BIB (ручное изменение номера) ===
  async updateBib(
    campId: string,
    userId: string,
    newBib: number,
  ): Promise<CampParticipant | null> {
    try {
      return await this.db.transaction(async (tx) => {
        const existing = (await tx
          .select({ userId: campParticipant.userId })
          .from(campParticipant)
          .where(
            and(
              eq(campParticipant.campId, campId),
              eq(campParticipant.bib, newBib),
            ),
          )
          .limit(1)) as { userId: string }[];

        if (existing.length > 0 && existing[0].userId !== userId) {
          throw new DbUniqueViolationException(
            [
              { dbField: 'camp_id', value: campId },
              { dbField: 'bib', value: newBib },
            ],
            'idx_camp_bib_unique',
          );
        }

        const result = (await tx
          .update(campParticipant)
          .set({ bib: newBib })
          .where(
            and(
              eq(campParticipant.campId, campId),
              eq(campParticipant.userId, userId),
            ),
          )
          .returning({
            campId: campParticipant.campId,
            userId: campParticipant.userId,
            bib: campParticipant.bib,
          })) as CampParticipant[];

        return result[0] || null;
      });
    } catch (error) {
      this.handleDbError(error, { campId, userId, bib: newBib });
    }
  }

  // === DELETE BY COMPOSITE KEY (одиночное удаление с пересчётом bib) ===
  async deleteByComposite(
    campId: string,
    userId: string,
  ): Promise<CampParticipant | null> {
    return await this.db
      .transaction(async (tx) => {
        const result = (await tx
          .delete(campParticipant)
          .where(
            and(
              eq(campParticipant.campId, campId),
              eq(campParticipant.userId, userId),
            ),
          )
          .returning({
            campId: campParticipant.campId,
            userId: campParticipant.userId,
            bib: campParticipant.bib,
          })) as CampParticipant[];

        if (result.length > 0) {
          await this.recalculateBibs(tx, campId);
        }
        return result[0] || null;
      })
      .catch((error) => {
        this.handleDbError(error, { campId, userId });
      });
  }

  // === FIND ALL BY CAMP (с данными пользователя) ===
  async findAllByCamp(campId: string): Promise<CampParticipantWithUser[]> {
    // 👇 Явно указываем тип возвращаемых строк
    type SelectRow = {
      campId: string;
      userId: string;
      bib: number;
      userFirstName: string;
      userLastName: string;
      userEmail: string;
    };

    const rows = (await this.db
      .select({
        campId: campParticipant.campId,
        userId: campParticipant.userId,
        bib: campParticipant.bib,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(campParticipant)
      .innerJoin(users, eq(campParticipant.userId, users.id))
      .where(eq(campParticipant.campId, campId))
      .orderBy(asc(campParticipant.bib))) as SelectRow[];

    return rows.map((row) => ({
      campId: row.campId,
      userId: row.userId,
      bib: row.bib,
      user: {
        firstName: row.userFirstName,
        lastName: row.userLastName,
        email: row.userEmail,
      },
    }));
  }

  // === FIND ALL BY USER ===
  async findAllByUser(userId: string): Promise<CampParticipant[]> {
    const rows = await this.db
      .select()
      .from(campParticipant)
      .where(eq(campParticipant.userId, userId));
    return rows as CampParticipant[];
  }

  // === DELETE ALL BY CAMP ===
  async deleteAllByCamp(campId: string): Promise<void> {
    await this.db
      .delete(campParticipant)
      .where(eq(campParticipant.campId, campId));
  }

  // === EXISTS ===
  async exists(campId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .select({ id: campParticipant.userId })
      .from(campParticipant)
      .where(
        and(
          eq(campParticipant.campId, campId),
          eq(campParticipant.userId, userId),
        ),
      )
      .limit(1);
    return result.length > 0;
  }
}
