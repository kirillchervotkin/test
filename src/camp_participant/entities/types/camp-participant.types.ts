// src/camp-participant/entities/types/camp-participant.types.ts

/**
 * Внутреннее представление участника лагеря (доменная сущность).
 * Используется в репозитории и сервисе.
 */
export interface CampParticipant {
  campId: string;
  userId: string;
  bib: number; // номер манишки, уникален в рамках лагеря
}

/**
 * Расширенный тип для ответа с данными пользователя.
 * Используется в методах, которые выполняют JOIN с таблицей users.
 */
export interface CampParticipantWithUser extends CampParticipant {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

/**
 * Данные для создания участника (передаются в репозиторий).
 * Поле bib будет назначено автоматически (по max(bib)+1).
 */
export type CreateCampParticipantData = Omit<CampParticipant, 'bib'>;

/**
 * Данные для обновления участника (передаются в репозиторий).
 * Для идентификации записи нужны campId и userId, обновить можно только bib.
 */
export type UpdateCampParticipantData = {
  campId: string;
  userId: string;
} & Partial<Pick<CampParticipant, 'bib'>>;
