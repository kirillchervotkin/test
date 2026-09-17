// src/questionnaires/entities/types/questionnaire.types.ts

/**
 * Внутреннее представление анкеты (доменная сущность).
 * Используется в репозитории и сервисе.
 */
export interface Questionnaire {
  userId: string; // первичный ключ = внешний ключ на users
  sportsCategory: string | null; // судейская категория
  orderNumber: string | null; // номер приказа
  assignmentDate: Date | null; // дата присвоения
  assigningAuthority: string | null; // орган, присвоивший категорию
  isFifaJudge: boolean | null; // судья FIFA
  fifaId: string | null; // FIFA ID
  hasVarLicense: boolean | null; // наличие лицензии VAR
  heightCm: number | null; // рост в см
  jogelEquipmentSize: string | null; // размер экипировки Jogel
  jogelShoeSize: number | null; // размер обуви Jogel
  citizenship: string | null; // гражданство
  countryOfResidence: string | null; // страна резидентства
  passportType: string | null; // вид паспорта
  passportSeries: string | null; // серия паспорта
  passportNumber: string | null; // номер паспорта
  issuedBy: string | null; // кем выдан
  issueDate: Date | null; // дата выдачи
  departmentCode: string | null; // код подразделения
  phone: string | null; // телефон
}

/**
 * Данные для создания анкеты (передаются в репозиторий).
 * Все поля опциональны, так как в БД они могут быть NULL,
 * кроме userId (обязателен для связи с пользователем).
 */
export type CreateQuestionnaireData = Omit<Questionnaire, never>; // все поля как в Questionnaire

/**
 * Данные для обновления анкеты (передаются в репозиторий).
 * userId обязателен для идентификации записи,
 * остальные поля опциональны для частичного обновления.
 */
export type UpdateQuestionnaireData = {
  userId: string;
} & Partial<Omit<Questionnaire, 'userId'>>;

/**
 * Расширенный тип анкеты с данными пользователя.
 * Используется для ответов на GET-запросы, когда нужны имя, фамилия и email.
 */
export type QuestionnaireWithUser = Questionnaire & {
  firstName: string;
  lastName: string;
  email: string | null;
};
