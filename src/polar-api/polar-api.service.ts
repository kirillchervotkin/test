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
  TrainingSessionsResponseSchema,
  RegisterUserResponseSchema,
  type TrainingSessionsResponse,
  type TrainingSessionFeature,
} from './interfaces.js';

export interface ListTrainingSessionsOptions {
  accessToken: string;
  /** ISO 8601, inclusive */
  from: Date | string;
  /** ISO 8601, exclusive */
  to: Date | string;
  /**
   * Если указаны — Polar разрешает диапазон не более 1 дня.
   * Без features — до 90 дней.
   */
  features?: TrainingSessionFeature[];
}

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
      validateStatus: () => true,
      // Polar ждёт features=samples&features=zones, а не features[]=samples
      paramsSerializer: { indexes: null },
    });
  }

  /**
   * Регистрирует пользователя в Polar AccessLink.
   *
   * Обязательный шаг после OAuth-авторизации. Без него запросы
   * к данным пользователя будут возвращать 403 Forbidden.
   *
   * Polar ведёт себя так:
   *   - 201 Created — новый пользователь, возвращает user-id;
   *   - 200 OK     — пользователь уже был зарегистрирован,
   *                  возвращает тот же user-id (идемпотентно).
   *
   * @param accessToken OAuth access token пользователя
   * @param memberId    Ваш внутренний ID пользователя
   * @returns Polar user-id (совпадает с x_user_id из OAuth-ответа)
   */
  async registerUser(accessToken: string, memberId: string): Promise<string> {
    const url = '/v3/users';

    const res = await this.http.post<unknown>(
      url,
      { 'member-id': memberId },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    // 201 — новый пользователь, 200 — уже существует.
    // Оба варианта успешны и возвращают user-id.
    if (res.status !== 201 && res.status !== 200) {
      this.assertOk(res.status, res.data, url);
    }

    const parsed = this.parse(RegisterUserResponseSchema, res.data, url);

    this.logger.log(
      `User ${memberId} registered in Polar | ` +
        `status=${res.status} polarUserId=${parsed['user-id']}`,
    );

    return parsed['user-id'];
  }

  /**
   * Список тренировочных сессий за диапазон [from, to).
   *
   * Ограничения Polar:
   *   - без features: максимум 90 дней за запрос;
   *   - с features: только 1 день за запрос.
   */
  async listTrainingSessions(
    opts: ListTrainingSessionsOptions,
  ): Promise<TrainingSessionsResponse> {
    const url = '/v4/training-sessions/list';

    const params: Record<string, string | string[]> = {
      from: this.toIso(opts.from),
      to: this.toIso(opts.to),
    };

    if (opts.features?.length) {
      this.assertFeatureRange(opts.from, opts.to, opts.features);
      params.features = [...opts.features];
    }

    const res = await this.http.get<unknown>(url, {
      params,
      headers: { Authorization: `Bearer ${opts.accessToken}` },
    });

    this.assertOk(res.status, res.data, url);

    return this.parse(TrainingSessionsResponseSchema, res.data, url);
  }

  // ─── Приватные хелперы ──────────────────────────────────

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
  }

  /**
   * Если указаны features, Polar разрешает запрашивать только 1 день.
   * Проверяем диапазон ДО запроса, чтобы не ловить 4xx.
   */
  private assertFeatureRange(
    from: Date | string,
    to: Date | string,
    features: TrainingSessionFeature[],
  ): void {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();

    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new InternalServerErrorException('Polar API: invalid from/to date');
    }

    const days = (toMs - fromMs) / (24 * 60 * 60 * 1000);
    if (days > 1.0001) {
      throw new InternalServerErrorException(
        `Polar API: features [${features.join(', ')}] allow only 1-day range, ` +
          `requested ${days.toFixed(2)} days`,
      );
    }
  }

  private assertOk(status: number, data: unknown, url: string): void {
    if (status >= 200 && status < 300) return;

    this.logger.error(
      `Polar API ${url} → HTTP ${status}: ${this.stringify(data, 500)}`,
    );

    if (status === 401) {
      throw new InternalServerErrorException(
        `Polar API unauthorized (token expired?) for ${url}`,
      );
    }
    if (status === 403) {
      throw new InternalServerErrorException(
        `Polar API forbidden (user not registered?) for ${url}`,
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

  /**
   * Структурный тип вместо ZodType<T> — не зависим от версии zod
   * и не ловим "error typed" от несовпадения generic-параметров.
   */
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
        this.logger.error(
          `Raw response (first 1000 chars): ${this.stringify(data, 1000)}`,
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
