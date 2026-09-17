// src/questionnaires/entities/questionnaire.schema.ts

import {
  ydbTable,
  uuid,
  text,
  date,
  integer,
  double,
  boolean,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const questionnaires = ydbTable(
  'questionnaires',
  {
    // Primary key – ссылка на пользователя
    userId: uuid('user_id').primaryKey().notNull(),

    // Судейские данные
    sportsCategory: text('sports_category'),
    orderNumber: text('order_number'),
    assignmentDate: date('assignment_date'),
    assigningAuthority: text('assigning_authority'),
    isFifaJudge: boolean('is_fifa_judge'),
    fifaId: text('fifa_id'),
    hasVarLicense: boolean('has_var_license'),

    // Физические параметры и экипировка
    heightCm: integer('height_cm'), // Int32 → integer (в YDB это Int32)
    jogelEquipmentSize: text('jogel_equipment_size'),
    jogelShoeSize: double('jogel_shoe_size'),

    // Паспортные и личные данные
    citizenship: text('citizenship'),
    countryOfResidence: text('country_of_residence'),
    passportType: text('passport_type'),
    passportSeries: text('passport_series'),
    passportNumber: text('passport_number'),
    issuedBy: text('issued_by'),
    issueDate: date('issue_date'),
    departmentCode: text('department_code'),
    phone: text('phone'),
  },
  () => [
    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
