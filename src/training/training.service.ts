// src/training/training.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  TrainingRepository,
  type SessionWithSamples,
  type RawSample,
  type SampleInput,
} from './repositories/training-session.repository.js';

import {
  type TrainingSession,
  type CreateTrainingSessionData,
  type UpdateTrainingSessionData,
} from './entities/types/training-session.types.js';
import type { SampleType } from './entities/types/training-samples.types.js';
import { SportTypeRepository } from './repositories/sport-type.repository.js';

/**
 * Максимальная длина периода запроса списка тренировок.
 *
 * Год — разумный предел: у активного пользователя это
 * 250–350 тренировок, они влезают в один ответ (~75–90 КБ JSON).
 * Если понадобится больше — либо разбивать на несколько запросов
 * по годам, либо вводить cursor-based пагинацию.
 */
const MAX_PERIOD_DAYS = 366;

/**
 * Дефолтный лимит записей на ответ. Достаточен, чтобы отдать
 * весь список за год активного пользователя одним запросом.
 *
 * Верхняя граница (1000) задаётся в DTO (`@Max(1000)`); сервис
 * получает уже провалидированное значение.
 */
const DEFAULT_SESSIONS_LIMIT = 500;

/**
 * Результат listSessions: список тренировок + словарь видов спорта,
 * встречающихся в выборке.
 *
 * `total` (общее количество за период) не возвращаем: без
 * offset-пагинации он не нужен, а показать в UI «всего N» можно
 * по длине массива, если запросили всё за период. Если понадобится
 * для счётчика при обрезанном по `limit` ответе — вернём отдельно.
 *
 * Словарь `sportTypes` содержит только те коды, которые реально
 * есть в `sessions` — не весь справочник. Это экономит трафик и
 * избавляет фронт от необходимости самостоятельно фильтровать.
 *
 * Структура словаря:
 *   { "running": { ru: "Бег", en: "Running" }, ... }
 */
export interface SessionListResult {
  sessions: TrainingSession[];
  sportTypes: Record<string, { ru: string; en: string }>;
}

/**
 * Результат getRawSamplesWithSession: id тренировки + её сырые блобы.
 *
 * `sessionId` нужен фронту, чтобы разложить ответ по сессиям
 * при пакетной загрузке (например, для списка графиков на
 * дашборде) или просто отобразить в логе/ошибке.
 */
export interface RawSamplesWithSession {
  sessionId: string;
  samples: Partial<Record<SampleType, RawSample>>;
}

/**
 * Сервис управления тренировками.
 *
 * Тонкая обёртка над {@link TrainingRepository} и
 * {@link SportTypeRepository}. Вся работа с БД (транзакции,
 * идемпотентность, обход protobuf null_type) инкапсулирована
 * в репозитории — сервис не инжектит DRIZZLE и не открывает
 * транзакции.
 *
 * Сервис добавляет только бизнес-семантику:
 *   - валидацию периода списка (from < to, не длиннее года);
 *   - перевод `null` в {@link NotFoundException} там, где это
 *     уместно для API;
 *   - объединение двух источников (тренировки + справочник) в
 *     один ответ для фронта.
 *
 * Исключения уровня БД (DbUniqueViolationException) не трогаются —
 * они транслируются в HTTP глобальным фильтром.
 *
 * Методы записи тренировок (`saveSessionWithSamples`) не бросают
 * NotFoundException: они вызываются из вебхуков и backfill'а,
 * где источник данных — Polar/Suunto. Если сессии нет — она
 * создаётся; если есть — обновляется. Это штатный сценарий, не
 * ошибка.
 */
@Injectable()
export class TrainingService {
  constructor(
    private readonly trainingRepo: TrainingRepository,
    private readonly sportTypeRepo: SportTypeRepository,
  ) {}

  // ============================================================
  // SAVE SESSION WITH SAMPLES
  //
  // Единственный метод записи тренировки с сэмплами.
  // Используется и вебхуком, и backfill'ом, и admin-переобработкой.
  //
  // Идемпотентен: повторный вызов с теми же данными не создаёт
  // дубликат (детерминированный id + PK + idempotent: true на
  // транзакции внутри репозитория).
  //
  // Не транслирует ошибки в HTTP-исключения: вызывающий код сам
  // решает, что делать с ошибкой (обычно — залогировать и
  // продолжить или вернуть 500).
  // ============================================================
  async saveSessionWithSamples(
    data: CreateTrainingSessionData,
    samples: SampleInput[],
  ): Promise<TrainingSession> {
    return this.trainingRepo.saveSessionWithSamples(data, samples);
  }

  // ============================================================
  // GET SESSION WITH SAMPLES
  //
  // Основной сценарий чтения для API: одна тренировка со всеми
  // сэмплами. Возвращает NotFoundException, если тренировки нет.
  //
  // Samples приходят распакованными (ParsedSample):
  //   { hr: { intervalSec: 5, values: [88, 90, ...] }, speed: {...} }
  //
  // Отсутствующие типы (провайдер их не прислал) в объекте
  // отсутствуют, а не равны null. Фронт отличает «нет данных»
  // от «пустые данные» по наличию ключа.
  // ============================================================
  async getSessionWithSamples(
    userId: string,
    provider: string,
    externalId: string,
  ): Promise<SessionWithSamples> {
    const result = await this.trainingRepo.getSessionWithSamples(
      userId,
      provider,
      externalId,
    );
    if (!result) {
      throw new NotFoundException(
        `Training session not found: provider=${provider}, externalId=${externalId}`,
      );
    }
    return result;
  }

  // ============================================================
  // LIST SESSIONS
  //
  // Список тренировок пользователя за период [from, to) + словарь
  // видов спорта, встречающихся в выборке.
  //
  // Сэмплы здесь НЕ читаются: список лёгкий, детали тянутся
  // отдельно при открытии конкретной тренировки
  // (getSessionWithSamples). Это стандартный паттерн list/detail.
  //
  // Пагинации нет: сценарий «показать ещё» пока не актуален.
  // Вместо неё — жёсткое ограничение периода (год) и защитный
  // `limit` с большим дефолтом (500). Если однажды понадобится
  // offset-пагинация — репозиторий `findSessionsByUserAndPeriod`
  // уже поддерживает `offset`, достаточно добавить его в DTO
  // и пробросить сюда.
  //
  // Справочник читается только для тех кодов, что реально есть
  // в выборке — не тянем весь `sport_types`.
  // ============================================================
  async listSessions(
    userId: string,
    from: Date,
    to: Date,
    limit: number = DEFAULT_SESSIONS_LIMIT,
  ): Promise<SessionListResult> {
    // Валидация периода. class-validator в DTO проверяет только
    // формат ISO 8601, но не кросс-полевые условия (from < to,
    // длина периода). Делаем это здесь — на уже приведённых
    // к Date значениях.
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid from/to date');
    }
    if (from >= to) {
      throw new BadRequestException('`from` must be earlier than `to`');
    }

    const periodDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (periodDays > MAX_PERIOD_DAYS) {
      throw new BadRequestException(
        `Period cannot exceed ${MAX_PERIOD_DAYS} days ` +
          `(requested ${Math.ceil(periodDays)})`,
      );
    }

    const sessions = await this.trainingRepo.findSessionsByUserAndPeriod(
      userId,
      from,
      to,
      limit,
      0, // offset всегда 0 — пагинация отключена в контракте
    );

    // Собираем уникальные коды спорта из выборки. `sport` может
    // быть null (провайдер не указал) — такие значения
    // отбрасываем, для них словаря не будет.
    const codes = [
      ...new Set(
        sessions.map((s) => s.sport).filter((s): s is string => s !== null),
      ),
    ];

    const types = await this.sportTypeRepo.findByCodes(codes);

    const sportTypes: Record<string, { ru: string; en: string }> = {};
    for (const t of types) {
      sportTypes[t.code] = { ru: t.displayRu, en: t.displayEn };
    }

    return { sessions, sportTypes };
  }

  // ============================================================
  // UPDATE USER FIELDS
  //
  // Обновляет поля, принадлежащие пользователю Arbitrator:
  // name, notes, sport. Провайдер сюда не пишет — только
  // пользователь через API.
  //
  // Семантика полей (см. UpdateTrainingSessionData):
  //   - undefined → «не трогать»;
  //   - null      → «очистить»;
  //   - значение  → записать.
  //
  // Бросает NotFoundException, если тренировки нет.
  // ============================================================
  async updateUserFields(
    userId: string,
    provider: string,
    externalId: string,
    patch: UpdateTrainingSessionData,
  ): Promise<TrainingSession> {
    const updated = await this.trainingRepo.updateUserFields(
      userId,
      provider,
      externalId,
      patch,
    );
    if (!updated) {
      throw new NotFoundException(
        `Training session not found: provider=${provider}, externalId=${externalId}`,
      );
    }
    return updated;
  }

  // ============================================================
  // DELETE SESSION
  //
  // Удаляет тренировку вместе со всеми её сэмплами — одна
  // транзакция внутри репозитория, чтобы не оставить «висячих»
  // сэмплов без родителя.
  //
  // Бросает NotFoundException, если тренировки нет.
  // Повторный DELETE того же ключа — тот же NotFoundException
  // (в отличие от идемпотентного DELETE, возвращающего 204 на
  // всё — здесь явная семантика «нечего удалять»).
  // ============================================================
  async deleteSession(
    userId: string,
    provider: string,
    externalId: string,
  ): Promise<void> {
    const deleted = await this.trainingRepo.deleteSession(
      userId,
      provider,
      externalId,
    );
    if (!deleted) {
      throw new NotFoundException(
        `Training session not found: provider=${provider}, externalId=${externalId}`,
      );
    }
  }

  // ============================================================
  // FIND SESSION BY ID
  //
  // Быстрый lookup по детерминированному хешу. Возвращает `null`,
  // если сессии нет — не бросает исключение. Вызывающий код
  // (например, админ-эндпоинт) сам решает, что делать.
  //
  // Основной сценарий — когда известен session_id, но неизвестен
  // полный ключ. Например, вебхук пришёл с entity_id, и мы уже
  // вычислили хеш из (userId, provider, entity_id).
  // ============================================================
  async findSessionById(id: string): Promise<TrainingSession | null> {
    return this.trainingRepo.findSessionById(id);
  }

  // ============================================================
  // GET RAW SAMPLES
  //
  // Сырые блобы без распаковки. Используется, когда фронт хочет
  // получить base64-строку: избегаем шага «распаковать →
  // переупаковать в base64» на бэке, экономим CPU и трафик.
  //
  // Один SELECT сессии по ключу (без сэмплов), затем один SELECT
  // блобов по её id. Никаких лишних чтений и распаковок.
  //
  // Требует, чтобы `findSessionByKey` был public в
  // TrainingRepository. См. соответствующий метод репозитория.
  //
  // Возвращает ТОЛЬКО карту сэмплов, без sessionId — этого
  // достаточно, если вызывающий код уже знает id (например,
  // админ-скрипт). Для API-эндпоинта используйте
  // getRawSamplesWithSession — он отдаёт оба поля одним вызовом.
  // ============================================================
  async getRawSamples(
    userId: string,
    provider: string,
    externalId: string,
  ): Promise<Partial<Record<SampleType, RawSample>>> {
    const session = await this.trainingRepo.findSessionByKey(
      userId,
      provider,
      externalId,
    );
    if (!session) {
      throw new NotFoundException(
        `Training session not found: provider=${provider}, externalId=${externalId}`,
      );
    }
    return this.trainingRepo.findRawSamplesBySession(session.id);
  }

  // ============================================================
  // GET RAW SAMPLES WITH SESSION
  //
  // Тот же сценарий, что getRawSamples, но возвращает ещё и
  // sessionId. Используется API-эндпоинтом
  // GET /training-sessions/:provider/:externalId/raw-samples,
  // где sessionId нужен в ответе (фронт отображает его или
  // раскладывает ответ по сессиям при пакетной загрузке).
  //
  // Внутри — тот же public-метод репозитория findSessionByKey,
  // что и в getRawSamples: один SELECT сессии + один SELECT
  // блобов. Никаких лишних чтений и распаковок.
  // ============================================================
  async getRawSamplesWithSession(
    userId: string,
    provider: string,
    externalId: string,
  ): Promise<RawSamplesWithSession> {
    const session = await this.trainingRepo.findSessionByKey(
      userId,
      provider,
      externalId,
    );
    if (!session) {
      throw new NotFoundException(
        `Training session not found: provider=${provider}, externalId=${externalId}`,
      );
    }

    const samples = await this.trainingRepo.findRawSamplesBySession(session.id);
    return { sessionId: session.id, samples };
  }
}
