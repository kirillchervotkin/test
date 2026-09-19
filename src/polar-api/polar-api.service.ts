// polar-api/polar-api.service.ts
import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { ZodError } from 'zod';
import {
  ExercisesResponseSchema,
  RegisterUserResponseSchema,
  PolarExerciseSchema,
  type ExercisesResponse,
  type ExerciseV3,
  type PolarExerciseV3,
} from './interfaces.js';

/**
 * Опции для получения списка тренировок через v3 API.
 *
 * ВАЖНО: v3-эндпоинт GET /v3/exercises не принимает from/to.
 * Он возвращает только тренировки за последние 30 дней.
 * Если нужен более широкий диапазон — используйте транзакции
 * (/v3/users/{id}/exercise-transactions), но это сложнее.
 */
export interface ListTrainingSessionsOptions {
  accessToken: string;
  /** ISO 8601 date (YYYY-MM-DD), inclusive. Используется для фильтрации на нашей стороне. */
  from: Date | string;
  /** ISO 8601 date (YYYY-MM-DD), exclusive. Используется для фильтрации на нашей стороне. */
  to: Date | string;
  /** Дополнительные данные в ответе. */
  includeSamples?: boolean;
  includeZones?: boolean;
  includeRoute?: boolean;
}

/**
 * Опции для получения одной тренировки через v3 API.
 */
export interface GetExerciseOptions {
  accessToken: string;
  /** Включить samples (HR, speed, cadence, ...) в ответ. */
  includeSamples?: boolean;
  /** Включить zones (пульсовые зоны) в ответ. */
  includeZones?: boolean;
  /** Включить route (GPS-трек) в ответ. */
  includeRoute?: boolean;
}

/**
 * Статус пользователя на стороне Polar (v3).
 * Определяется через GET /v3/users/{polar-user-id}.
 */
export type PolarUserStatus =
  | 'connected' // 200 — зарегистрирован, согласия приняты
  | 'consents_required' // 403 — зарегистрирован, но согласия не приняты
  | 'not_registered'; // 204 / 401 — не зарегистрирован или токен отозван

@Injectable()
export class PolarApiService {
  private readonly logger = new Logger(PolarApiService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const baseURL = this.config.get<string>(
      'POLAR_API_BASE_URL',
      'https://www.polaraccesslink.com',
    );

    this.http = axios.create({
      baseURL,
      timeout: this.config.get<number>('POLAR_API_TIMEOUT_MS', 30_000),
      headers: { Accept: 'application/json' },
      validateStatus: () => true, // не бросаем на 4xx — обрабатываем сами
      paramsSerializer: { indexes: null },
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  v3 API: управление пользователями
  // ═══════════════════════════════════════════════════════════

  /**
   * Регистрирует пользователя в Polar AccessLink через v3 API.
   *
   * POST /v3/users
   *
   * Polar ведёт себя так:
   *   - 201 Created — новый пользователь, возвращает polar-user-id;
   *   - 200 OK     — пользователь уже был зарегистрирован, возвращает
   *                  тот же polar-user-id (идемпотентно).
   *
   * @param accessToken OAuth access token пользователя
   * @param memberId    Ваш внутренний ID пользователя Arbitrator
   * @returns polar-user-id (строка)
   */
  async registerUser(
    accessToken: string,
    memberId: string,
    expectedPolarUserId?: string,
  ): Promise<string> {
    const url = '/v3/users';

    let res = await this.http.post<unknown>(
      url,
      { 'member-id': memberId },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    // Повторная регистрация может вернуть 409. Проверяем,
    // что существующий пользователь — это тот же member-id.
    if (res.status === 409 && expectedPolarUserId) {
      res = await this.http.get<unknown>(
        `/v3/users/${encodeURIComponent(expectedPolarUserId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      this.assertOk(res.status, res.data, url);
      const existing = this.parse(RegisterUserResponseSchema, res.data, url);
      if (
        existing['member-id'] !== memberId ||
        existing['polar-user-id'] !== expectedPolarUserId
      ) {
        throw new InternalServerErrorException(
          'Polar account is linked to another member',
        );
      }
    }

    // 201 — новый пользователь, 200 — данные существующего.
    if (res.status !== 201 && res.status !== 200) {
      this.assertOk(res.status, res.data, url);
    }

    const parsed = this.parse(RegisterUserResponseSchema, res.data, url);

    this.logger.log(
      `User ${memberId} registered in Polar | ` +
        `status=${res.status} polarUserId=${parsed['polar-user-id']}`,
    );

    return parsed['polar-user-id'];
  }

  /**
   * Проверяет актуальный статус пользователя на стороне Polar.
   *
   * GET /v3/users/{polar-user-id}
   *
   *   - 200 → 'connected'         — зарегистрирован, согласия приняты
   *   - 403 → 'consents_required' — зарегистрирован, но согласия не приняты
   *   - 204 → 'not_registered'    — пользователя нет в приложении
   *   - 401 → 'not_registered'    — токен отозван/протух
   */
  async getPolarUserStatus(
    polarUserId: string,
    accessToken: string,
  ): Promise<PolarUserStatus> {
    const url = `/v3/users/${encodeURIComponent(polarUserId)}`;

    const res = await this.http.get<unknown>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 200) return 'connected';
    if (res.status === 403) return 'consents_required';
    if (res.status === 204) return 'not_registered';
    if (res.status === 401) return 'not_registered';

    // Всё остальное — реальная ошибка (5xx, 429, неизвестный 4xx).
    this.assertOk(res.status, res.data, url);
    return 'not_registered';
  }

  /**
   * DELETE /v3/users/{polar-user-id}
   *
   * ВНИМАНИЕ: использовать с осторожностью. Дерегистрация
   * пользователя через API может привести к тому, что при повторной
   * попытке OAuth Polar вернёт 403 при регистрации.
   *
   * В большинстве случаев для «отвязки» достаточно удалить
   * локальные токены (это делает OAuthTokenService.revokeToken).
   */
  async deregisterUser(
    polarUserId: string,
    accessToken: string,
  ): Promise<void> {
    const url = `/v3/users/${encodeURIComponent(polarUserId)}`;

    const res = await this.http.delete<unknown>(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 204 || res.status === 404 || res.status === 403) {
      return;
    }

    this.assertOk(res.status, res.data, url);
  }

  // ═══════════════════════════════════════════════════════════
  //  v3 API: тренировки
  // ═══════════════════════════════════════════════════════════

  /**
   * Список тренировочных сессий.
   *
   * GET /v3/exercises
   *
   * ВАЖНО: v3-эндпоинт возвращает МАССИВ тренировок напрямую,
   * без обёртки в объект:
   *   [ { "id": "...", "start_time": "...", ... }, ... ]
   *
   * (В v4 было `{ trainingSessions: [...] }` — здесь иначе.)
   *
   * ВАЖНО: эндпоинт возвращает только тренировки за последние
   * 30 дней и не принимает параметры from/to. Фильтрация по датам
   * выполняется на нашей стороне — отбрасываем всё, что вне диапазона.
   *
   * Поля в ответе — snake_case (start_time, heart_rate, ...),
   * в отличие от v4, где используется camelCase.
   */
  async listTrainingSessions(
    opts: ListTrainingSessionsOptions,
  ): Promise<ExercisesResponse> {
    const basePath = '/v3/exercises';

    // Собираем query вручную.
    const queryParts: string[] = [];
    if (opts.includeSamples) queryParts.push('samples=true');
    if (opts.includeZones) queryParts.push('zones=true');
    if (opts.includeRoute) queryParts.push('route=true');

    const fullUrl =
      queryParts.length > 0 ? `${basePath}?${queryParts.join('&')}` : basePath;

    this.logger.log(`listTrainingSessions REQUEST URL: ${fullUrl}`);

    const res = await this.http.get<unknown>(fullUrl, {
      headers: { Authorization: `Bearer ${opts.accessToken}` },
    });

    this.logger.log(
      `listTrainingSessions RESPONSE: status=${res.status} ` +
        `body=${this.stringify(res.data, 300)}`,
    );

    this.assertOk(res.status, res.data, basePath);

    // Явно указываем generic, чтобы TS знал тип parsed.
    // ExercisesResponse — это ExerciseV3[] (массив), а не объект.
    const parsed = this.parse<ExercisesResponse>(
      ExercisesResponseSchema,
      res.data,
      basePath,
    );

    // Фильтруем на стороне приложения, потому что v3 не умеет
    // фильтровать по from/to.
    const fromMs = new Date(opts.from).getTime();
    const toMs = new Date(opts.to).getTime();

    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new InternalServerErrorException('Polar API: invalid from/to date');
    }

    // ВАЖНО: v3 возвращает start_time (snake_case), а не startTime.
    // parsed — массив, обращаемся к нему напрямую, без .exercises.
    const filtered: ExerciseV3[] = parsed.filter((ex: ExerciseV3) => {
      const startMs = new Date(ex.start_time).getTime();
      return startMs >= fromMs && startMs < toMs;
    });

    this.logger.log(
      `listTrainingSessions: Polar returned ${parsed.length} exercise(s), ` +
        `${filtered.length} after date filtering`,
    );

    return filtered;
  }

  /**
   * Получить одну тренировку по её hashed id.
   *
   * GET /v3/exercises/{exerciseId}
   *
   * Параметры samples/zones/route включают дополнительные данные
   * в ответ. Для сохранения нам нужны samples (пульс, скорость, ...),
   * поэтому вызывающий код обычно передаёт includeSamples: true.
   *
   * Возвращает распарсенный PolarExerciseV3. Если Polar ответит
   * 401/403/404 — assertOk бросит InternalServerErrorException
   * с описанием статуса и тела ответа.
   *
   * ВРЕМЕННО: логируем сырой ответ ДО parse. Это нужно, чтобы
   * точно подогнать Zod-схему под реальный формат Polar (он
   * отличается от документации — например, `samples[].sample-type`
   * может приходить в другом виде). После отладки логирование
   * можно убрать или понизить до trace-уровня.
   */
  async getExercise(
    exerciseId: string,
    opts: GetExerciseOptions,
  ): Promise<PolarExerciseV3> {
    const basePath = `/v3/exercises/${encodeURIComponent(exerciseId)}`;

    const query: string[] = [];
    if (opts.includeSamples) query.push('samples=true');
    if (opts.includeZones) query.push('zones=true');
    if (opts.includeRoute) query.push('route=true');

    const fullUrl =
      query.length > 0 ? `${basePath}?${query.join('&')}` : basePath;

    this.logger.log(`getExercise REQUEST URL: ${fullUrl}`);

    const res = await this.http.get<unknown>(fullUrl, {
      headers: { Authorization: `Bearer ${opts.accessToken}` },
    });

    this.assertOk(res.status, res.data, basePath);

    // ── ВРЕМЕННОЕ ЛОГИРОВАНИЕ ──
    // Печатаем структуру ответа: ключи верхнего уровня и первый
    // элемент samples. Полный JSON может быть огромным (samples
    // с 10 000 точек), поэтому выводим ограниченно — только то,
    // что нужно для отладки схемы.
    //
    // Что ищем:
    //   - как реально называется поле type в samples
    //     (sample-type / sampleType / type)?
    //   - что в recording-rate — число, массив или строка?
    //   - что в data — строка "1,2,3" или массив [1,2,3]?
    //   - есть ли training_load_pro.date, и если нет — какие
    //     поля там вообще есть?
    this.logger.debug(
      `getExercise RAW keys: ${this.stringify(
        res.data && typeof res.data === 'object'
          ? Object.keys(res.data)
          : res.data,
        500,
      )}`,
    );

    const samplesPreview = this.extractSamplesPreview(res.data);
    if (samplesPreview !== null) {
      this.logger.debug(
        `getExercise RAW samples[0] shape: ${this.stringify(
          samplesPreview,
          1000,
        )}`,
      );
    }

    const loadProPreview = this.extractTrainingLoadPro(res.data);
    if (loadProPreview !== null) {
      this.logger.debug(
        `getExercise RAW training_load_pro shape: ${this.stringify(
          loadProPreview,
          500,
        )}`,
      );
    }
    // ── КОНЕЦ ВРЕМЕННОГО ЛОГИРОВАНИЯ ──

    return this.parse<PolarExerciseV3>(PolarExerciseSchema, res.data, basePath);
  }

  // ─── Приватные хелперы ──────────────────────────────────

  /**
   * Достаёт первый элемент samples из сырого ответа, если он есть.
   * Возвращает null, если samples нет или структура неожиданная.
   * Используется только для отладочного логирования.
   */
  private extractSamplesPreview(data: unknown): unknown {
    if (!data || typeof data !== 'object') return null;
    const obj = data as Record<string, unknown>;
    const samples = obj.samples;
    if (!Array.isArray(samples) || samples.length === 0) return null;
    return samples[0];
  }

  /**
   * Достаёт training_load_pro из сырого ответа, если он есть.
   * Возвращает null, если поля нет.
   * Используется только для отладочного логирования.
   */
  private extractTrainingLoadPro(data: unknown): unknown {
    if (!data || typeof data !== 'object') return null;
    const obj = data as Record<string, unknown>;
    return obj.training_load_pro ?? null;
  }

  private assertOk(status: number, data: unknown, url: string): void {
    if (status >= 200 && status < 300) return;

    this.logger.error(
      `Polar API ${url} → HTTP ${status}: ${this.stringify(data, 500)}`,
    );

    if (status === 401) {
      throw new InternalServerErrorException(
        `Polar API unauthorized (token expired or missing scope?) for ${url}`,
      );
    }
    if (status === 403) {
      throw new InternalServerErrorException(
        `Polar API forbidden (consents missing or user not authorized?) for ${url}`,
      );
    }
    if (status === 429) {
      throw new InternalServerErrorException(
        `Polar API rate limited for ${url}`,
      );
    }

    throw new InternalServerErrorException(
      `Polar API ${url} failed with status ${status}`,
    );
  }

  private parse<T>(
    schema: { parse: (data: unknown) => T },
    data: unknown,
    url: string,
  ): T {
    try {
      return schema.parse(data);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        this.logger.error(
          `Polar API ${url} validation failed: ${err.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
        );
        throw new InternalServerErrorException(
          `Polar API response validation failed for ${url}`,
        );
      }
      throw err;
    }
  }

  private stringify(data: unknown, max: number): string {
    try {
      const s = typeof data === 'string' ? data : JSON.stringify(data);
      if (!s) return '';
      return s.length > max ? `${s.slice(0, max)}…` : s;
    } catch {
      return String(data);
    }
  }
}
