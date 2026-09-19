// src/training/mappers/training-session.mapper.ts

import {
  TrainingSessionListItemDto,
  TrainingSessionWithSamplesDto,
} from '../dto/training-session-response.dto.js';
import { ListTrainingSessionsResponseDto } from '../dto/list-training-sessions-response.dto.js';
import {
  ParsedSampleDto,
  RawSampleDto,
  RawSamplesResponseDto,
} from '../dto/samples-response.dto.js';
import { UpdateTrainingSessionDto } from '../dto/update-training-session.dto.js';

import type {
  TrainingSession,
  UpdateTrainingSessionData,
} from '../entities/types/training-session.types.js';
import type { SampleType } from '../entities/types/training-samples.types.js';
import type {
  RawSample,
  SessionWithSamples,
} from '../repositories/training-session.repository.js';
import type { SessionListResult } from '../training.service.js';

/**
 * Маппер между доменными сущностями тренировок и DTO контроллера.
 *
 * Все методы статические: маппер не держит состояния, не зависит
 * от DI и не работает с БД. Это чистое преобразование «тип → тип».
 *
 * Три направления:
 *   1. entity → DTO для ответа клиенту
 *      (toListItem, toWithSamples, toListResult, toRawSamplesResponse);
 *   2. DTO → domain data для записи в БД
 *      (toUpdateData);
 *   3. base64-упаковка raw-блob'ов для передачи фронту
 *      (внутри toRawSamplesResponse).
 *
 * Стиль намеренно совпадает с TestTypeMapper: один класс, статические
 * методы, подробный JSDoc с объяснением «почему», а не только «что».
 */
export class TrainingSessionMapper {
  // ============================================================
  // ENTITY → DTO (чтение)
  // ============================================================

  /**
   * Доменная сущность → элемент списка тренировок.
   *
   * Все поля передаются как есть (name/notes уже `string | null`
   * в доменном типе). Провайдер-специфичные детали (device,
   * club_name, detailed_sport_info) сюда не попадают — их в
   * канонической модели нет.
   *
   * Сэмплы НЕ включаются: список лёгкий, детали тянутся отдельно
   * через getSessionWithSamples. Это стандартный паттерн list/detail,
   * который экономит трафик и время ответа.
   */
  static toListItem(entity: TrainingSession): TrainingSessionListItemDto {
    return {
      id: entity.id,
      provider: entity.provider,
      externalId: entity.externalId,
      startTime: entity.startTime,
      durationSec: entity.durationSec,
      sport: entity.sport,
      distanceM: entity.distanceM,
      calories: entity.calories,
      hrAvg: entity.hrAvg,
      hrMax: entity.hrMax,
      hrMin: entity.hrMin,
      ascentM: entity.ascentM,
      descentM: entity.descentM,
      name: entity.name,
      notes: entity.notes,
    };
  }

  /**
   * Список доменных сущностей → массив DTO.
   *
   * Отдельный метод (а не `entities.map(e => this.toListItem(e))`
   * в контроллере), потому что список используется в двух местах:
   * в ответе `listSessions` и в ответе `updateUserFields`. Один
   * вызов — единый формат.
   */
  static toListItems(
    entities: TrainingSession[],
  ): TrainingSessionListItemDto[] {
    return entities.map((e) => this.toListItem(e));
  }

  /**
   * Тренировка с распакованными сэмплами → DTO.
   *
   * `result.samples` приходит из репозитория уже распакованным
   * (ParsedSample = { intervalSec, values }). Здесь только
   * копируем без изменений в форму, которую ожидает фронт.
   *
   * Partial<Record<SampleType, ParsedSample>> сохраняется как есть:
   * отсутствующие типы (провайдер их не прислал) остаются
   * отсутствующими ключами, а не превращаются в `null`. Фронт по
   * наличию ключа отличает «нет данных» от «данные пустые».
   */
  static toWithSamples(
    result: SessionWithSamples,
  ): TrainingSessionWithSamplesDto {
    const samples: Partial<Record<SampleType, ParsedSampleDto>> = {};

    for (const type of Object.keys(result.samples) as SampleType[]) {
      const sample = result.samples[type];
      if (!sample) continue;

      samples[type] = {
        intervalSec: sample.intervalSec,
        values: sample.values,
      };
    }

    return {
      ...this.toListItem(result.session),
      samples,
    };
  }

  /**
   * Результат listSessions → DTO для ответа.
   *
   * `sportTypes` приходит из сервиса уже в формате
   * `Record<code, { ru, en }>` — передаём как есть.
   *
   * Пагинации нет: `sessions` — это весь список за запрошенный
   * период. Период ограничен годом в сервисе, поэтому ответ
   * предсказуемо помещается в память фронта (250–350 тренировок
   * активного пользователя — ~75–90 КБ JSON).
   */
  static toListResult(
    result: SessionListResult,
  ): ListTrainingSessionsResponseDto {
    return {
      sessions: this.toListItems(result.sessions),
      sportTypes: result.sportTypes,
    };
  }

  // ============================================================
  // RAW SAMPLES → DTO
  // ============================================================

  /**
   * Сырые блобы → DTO с base64.
   *
   * Зачем base64, а не массив чисел: фронт декодирует base64 в
   * DataView напрямую и строит график. Передавать массив чисел
   * в JSON — в 8–10 раз больше трафика (JSON overhead на каждый
   * элемент) и лишний CPU на бэке (pack → JSON → фронт → unpack).
   *
   * base64 раздувает блоб на 33%, но всё равно в разы компактнее
   * JSON-массива. Плюс на бэке не нужно распаковывать блоб, чтобы
   * его тут же сериализовать в JSON — экономия CPU при частых
   * запросах графиков.
   *
   * `sessionId` передаётся отдельно, потому что сервис
   * `getRawSamples` возвращает только карту сэмплов. Если в
   * будущем сервис начнёт возвращать `{ sessionId, samples }` —
   * убери этот параметр.
   */
  static toRawSamplesResponse(
    sessionId: string,
    raw: Partial<Record<SampleType, RawSample>>,
  ): RawSamplesResponseDto {
    const samples: Partial<Record<SampleType, RawSampleDto>> = {};

    for (const type of Object.keys(raw) as SampleType[]) {
      const sample = raw[type];
      if (!sample) continue;

      samples[type] = {
        intervalSec: sample.intervalSec,
        samplesBase64: sample.samples.toString('base64'),
      };
    }

    return { sessionId, samples };
  }

  // ============================================================
  // DTO → DOMAIN DATA (запись)
  // ============================================================

  /**
   * DTO обновления → данные для репозитория.
   *
   * Обновляются ТОЛЬКО пользовательские поля: name, notes, sport.
   * Провайдерские метрики (distance, hr, calories, время, сэмплы)
   * неизменны через API — они источник истины в Polar/Suunto.
   *
   * Семантика совпадает с `UpdateTrainingSessionData`:
   *   - ключ отсутствует (undefined) → «не трогать колонку»;
   *   - `null`                       → «очистить»;
   *   - значение                     → «записать».
   *
   * ⚠️ Проверка именно `!== undefined`, а не truthy-проверка:
   * `null` — осмысленное значение («очистить»), а пустая строка
   * `""` — валидное значение для name/notes (пользователь мог
   * стереть текст). Truthy-проверка `if (dto.name)` пропустила бы
   * и `null`, и `""`, и это было бы багом.
   *
   * `null` в возвращаемом объекте уходит в БД через `nullsToSql`
   * в репозитории → SQL-литерал NULL. Это обходит проблему
   * protobuf `null_type`, из-за которой YDB-драйвер падает на
   * bind-параметрах со значением JS-`null`. См. JSDoc
   * `TrainingRepository.updateUserFields` для деталей.
   */
  static toUpdateData(
    dto: UpdateTrainingSessionDto,
  ): UpdateTrainingSessionData {
    const data: UpdateTrainingSessionData = {};

    // Явная проверка `!== undefined`, а не `if (dto.x)`:
    // null и пустая строка — валидные значения, их нужно сохранить.
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.sport !== undefined) data.sport = dto.sport;

    return data;
  }
}
