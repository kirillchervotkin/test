// src/training/adapters/polar.adapter.ts

import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';

import type {
  PolarExerciseV3,
  PolarSampleV3,
} from '../../polar-api/interfaces.js';
import type { CreateTrainingSessionData } from '../entities/types/training-session.types.js';
import type {
  SampleInput,
  SampleType,
} from '../entities/types/training-samples.types.js';

/**
 * Маппинг ответа Polar AccessLink v3 (GET /v3/exercises/{id})
 * в канонические типы тренировок Arbitrator.
 *
 * Задачи адаптера:
 *   1. Привести поля Polar к нормализованному виду:
 *      - snake_case → camelCase;
 *      - ISO 8601 duration → секунды;
 *      - локальное время + offset → UTC Date;
 *      - числовые коды sample_type → строковые SampleType.
 *   2. Отбросить всё, что не входит в каноническую модель
 *      (детали провайдера — device, club_name, detailed_sport_info).
 *   3. НЕ переносить пользовательские поля (name, notes) —
 *      они управляются только через API Arbitrator.
 *
 * Адаптер stateless и не зависит от БД. Все методы — чистые
 * преобразования.
 */
@Injectable()
export class PolarAdapter {
  private readonly logger = new Logger(PolarAdapter.name);

  /**
   * Преобразует Polar exercise в канонические данные тренировки.
   *
   * `userId` передаётся отдельно — в ответе Polar его нет, он
   * приходит из контекста (кто обрабатывает вебхук).
   *
   * ascentM / descentM: Polar v3 в одиночном ответе их не отдаёт,
   * поэтому считаем сами из канала altitude. Формула и порог —
   * в computeAscentDescent.
   */
  toSessionData(
    exercise: PolarExerciseV3,
    userId: string,
  ): CreateTrainingSessionData {
    const samples = this.toSamples(exercise);
    const altitude = samples.find((s) => s.sampleType === 'altitude');
    const elevation =
      altitude && altitude.values.length > 1
        ? this.computeAscentDescent(altitude.values)
        : null;

    return {
      userId,
      provider: 'polar',
      externalId: exercise.id,
      startTime: this.parsePolarDate(
        exercise.start_time,
        exercise.start_time_utc_offset,
      ),
      durationSec: this.parseIsoDuration(exercise.duration),
      sport: this.normalizeSport(exercise.sport),
      distanceM: exercise.distance,
      calories: exercise.calories,
      hrAvg: exercise.heart_rate?.average,
      hrMax: exercise.heart_rate?.maximum,
      ascentM: elevation?.ascentM,
      descentM: elevation?.descentM,
      // hrMin — Polar v3 не отдаёт; оставляем undefined,
      // filterNullish в репозитории отбросит отсутствующее поле.
      //
      // name, notes — пользовательские поля Arbitrator. Провайдер
      // их не знает и не должен перезаписывать.
    };
  }

  /**
   * Преобразует samples Polar в массив SampleInput.
   *
   * Реальный формат (проверено на живом ответе Polar v3):
   *   { "recording_rate": 1, "sample_type": 0, "data": "145,146,147,..." }
   *   { "recording_rate": 1, "sample_type": 1, "data": "3.2,3.4,3.1,..." }
   *
   * Ключи в snake_case (не kebab-case, как в документации),
   * `sample_type` — число, 0-based (см. mapSampleType).
   *
   * Возвращаем по одному SampleInput на канал. Каналы с
   * неизвестными кодами пропускаем — Polar иногда шлёт лишние
   * каналы (RR, swimming и т.п.), которые мы не храним.
   */
  toSamples(exercise: PolarExerciseV3): SampleInput[] {
    if (!exercise.samples || exercise.samples.length === 0) {
      return [];
    }

    const result: SampleInput[] = [];

    for (const s of exercise.samples) {
      const type = this.mapSampleType(s.sample_type);
      if (!type) {
        // Неизвестный код (RR, swimming-фазы, что-то новое от Polar).
        // Пропускаем молча — это не ошибка, а «не наш канал».
        continue;
      }

      const values = this.parseSampleData(s);
      if (values.length === 0) {
        // Пустой канал (например, data = "") — пропускаем, чтобы
        // не класть в БД пустой блоб.
        continue;
      }

      result.push({
        sampleType: type,
        intervalSec: s.recording_rate,
        values,
      });
    }

    return result;
  }

  // ─── Приватные преобразования ─────────────────────────────

  /**
   * Считает набор и сброс высоты по массиву altitude-сэмплов.
   *
   * Зачем порог и сглаживание:
   *   Барометрический альтиметр шумит на ±1–2 м. «Сырая» сумма
   *   положительных и отрицательных разниц на 3600 точках даёт
   *   сотни метров фиктивных значений. Поэтому:
   *
   *   1. Сглаживаем окном `smoothWindow` точек — убираем
   *      высокочастотный шум (по умолчанию 10 точек; при
   *      intervalSec=1 это 10 секунд).
   *   2. Идём по сглаженному ряду и сравниваем каждую точку
   *      с последней «зафиксированной» отметкой `ref`. Когда
   *      отклонение превысило `minDelta` — фиксируем дельту и
   *      сдвигаем `ref` на текущую точку.
   *
   * Почему НЕ по соседним точкам:
   *   При подъёме 300 м за 30 минут и записи раз в секунду
   *   соседние дельты ~0.17 м, каждая меньше minDelta. Порог
   *   по соседним точкам отсёк бы всё, и ascent был бы 0.
   *   Накопление от `ref` корректно суммирует постепенный
   *   подъём и при этом игнорирует мелкий шум ±0.5 м: он не
   *   наберёт порог ни вверх, ни вниз.
   *
   * Если точек меньше двух — возвращаем null: считать нечего,
   * ascent/descent останутся undefined в sessionData.
   */
  private computeAscentDescent(
    altitude: number[],
    opts: { smoothWindow?: number; minDelta?: number } = {},
  ): { ascentM: number; descentM: number } | null {
    const smoothWindow = opts.smoothWindow ?? 10;
    const minDelta = opts.minDelta ?? 1.5;

    if (altitude.length < 2) return null;

    // Скользящее среднее. NaN/Infinity не попадают сюда — выше
    // parseSampleData уже заменил их на 0, но защищаемся повторно
    // на случай прямого вызова с «грязным» массивом.
    //
    // Реализация через [] + push: new Array(n) без generic
    // возвращает any[], и линтер @typescript-eslint/no-unsafe-
    // assignment ругается. Производительность на наших объёмах
    // (до ~20k точек) не отличается.
    const half = Math.floor(smoothWindow / 2);
    const smoothed: number[] = [];

    for (let i = 0; i < altitude.length; i++) {
      const lo = Math.max(0, i - half);
      const hi = Math.min(altitude.length - 1, i + half);
      let sum = 0;
      let n = 0;
      for (let j = lo; j <= hi; j++) {
        const v = altitude[j];
        if (Number.isFinite(v)) {
          sum += v;
          n++;
        }
      }
      smoothed.push(n > 0 ? sum / n : altitude[i]);
    }

    // Накапливаем дельты не между соседними точками, а от
    // последней «зафиксированной» отметки `ref`. См. JSDoc выше —
    // почему порог по соседним точкам даёт ложный ноль на
    // плавном подъёме.
    let ascent = 0;
    let descent = 0;
    let ref = smoothed[0];

    for (let i = 1; i < smoothed.length; i++) {
      const d = smoothed[i] - ref;
      if (d >= minDelta) {
        ascent += d;
        ref = smoothed[i];
      } else if (d <= -minDelta) {
        descent += -d;
        ref = smoothed[i];
      }
    }

    return {
      ascentM: Math.round(ascent),
      descentM: Math.round(descent),
    };
  }

  /**
   * Парсит строку значений Polar ("88,90,92") в массив чисел.
   *
   * Особенности:
   *   - Polar иногда оставляет пустые ячейки ("88,,90") — превращаем
   *     их в 0. Это лучше, чем NaN (который потом отсекается клампом
   *     в packSamples, но лучше решить проблему здесь).
   *   - На всякий случай логируем, если что-то не парсится в число.
   *
   * Реализация через [] + push, а не new Array(n): линтер
   * @typescript-eslint/no-unsafe-assignment ругается на any[],
   * который возвращает new Array. Производительность на наших
   * объёмах (до ~20k точек) не отличается.
   */
  private parseSampleData(sample: PolarSampleV3): number[] {
    const raw = sample.data;
    if (!raw) return [];

    const parts = raw.split(',');
    const result: number[] = [];

    for (const part of parts) {
      const trimmed = part.trim();
      const num = Number(trimmed);
      result.push(Number.isFinite(num) ? num : 0);
    }

    return result;
  }

  /**
   * Маппинг числового кода Polar в канонический SampleType.
   *
   * ⚠️ Коды Polar AccessLink v3 — 0-based (проверено на живом API):
   *   0 — Heart rate
   *   1 — Speed
   *   2 — Cadence
   *   3 — Altitude
   *   4 — Power
   *   5 — Distance
   *   6 — Temperature
   *   7+ — прочие (RR, ...) — не поддерживаются
   *
   * ВНИМАНИЕ: не путать с v4, где используются строковые типы
   * ("HEART_RATE", "SPEED", ...) и своя, другая нумерация.
   * Если коды съедут на 1 (как было раньше), speed уедет под ключ
   * hr, и график пульса покажет 3–6 «уд/мин» вместо 130–180.
   *
   * Неизвестные коды возвращают null — вызывающий код пропустит
   * канал.
   */
  private mapSampleType(polarType: number): SampleType | null {
    switch (polarType) {
      case 0:
        return 'hr';
      case 1:
        return 'speed';
      case 2:
        return 'cadence';
      case 3:
        return 'altitude';
      case 4:
        return 'power';
      case 5:
        return 'distance';
      case 6:
        return 'temperature';
      default:
        return null;
    }
  }

  /**
   * Парсит ISO 8601 duration в секунды.
   *
   * Примеры:
   *   "PT2H44M"       → 9840
   *   "PT2H44M33S"    → 9873
   *   "PT30M"         → 1800
   *   "PT45S"         → 45
   *   "PT1H30M15S"    → 5415
   *   "P1DT2H"        → 93600
   *
   * Дробные секунды (".026S") допускаются, но округляются вниз —
   * на точность длительности тренировки это не влияет.
   *
   * Если строка не парсится — бросаем: это сигнал, что формат
   * Polar изменился, и лучше узнать об этом сразу, чем записать
   * duration = 0.
   */
  private parseIsoDuration(duration: string): number {
    const match =
      /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(
        duration,
      );

    if (!match) {
      throw new InternalServerErrorException(
        `Polar adapter: invalid ISO 8601 duration "${duration}"`,
      );
    }

    const days = match[1] ? Number(match[1]) : 0;
    const hours = match[2] ? Number(match[2]) : 0;
    const minutes = match[3] ? Number(match[3]) : 0;
    const seconds = match[4] ? Math.floor(Number(match[4])) : 0;

    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Собирает UTC Date из локального времени Polar и его offset.
   *
   * Polar v3 отдаёт `start_time` в локальном времени пользователя
   * (без таймзоны) и `start_time_utc_offset` — сдвиг в минутах.
   * Чтобы получить UTC, нужно из локального времени вычесть offset.
   *
   * Пример:
   *   start_time = "2008-10-13T10:40:02"
   *   start_time_utc_offset = 180   (UTC+3)
   *   → UTC = 2008-10-13T07:40:02Z
   *
   * Если offset не задан — считаем, что время уже в UTC.
   * Это разумный дефолт: в v4 Polar работает только в UTC,
   * а в v3 поле опционально, но если оно отсутствует — обычно
   * означает, что таймзона не определилась, и записывать время
   * как есть — наименее рискованное решение.
   */
  private parsePolarDate(local: string, offsetMinutes?: number): Date {
    const asUtc = new Date(`${local}Z`);

    if (Number.isNaN(asUtc.getTime())) {
      throw new InternalServerErrorException(
        `Polar adapter: invalid start_time "${local}"`,
      );
    }

    if (offsetMinutes == null) {
      return asUtc;
    }

    return new Date(asUtc.getTime() - offsetMinutes * 60 * 1000);
  }

  /**
   * Нормализует sport Polar в канонический код.
   *
   * Polar отдаёт общие коды: "RUNNING", "CYCLING", "WALKING",
   * "SWIMMING", "STRENGTH_TRAINING", "OTHER" и т.д.
   *
   * Если приходит что-то не из списка — матчим по подстроке.
   * Если совсем не понятно — 'other'.
   *
   * Значения должны быть согласованы с `SportCode` в
   * `training-session.types.ts` и записями в таблице `sport_types`.
   */
  private normalizeSport(raw: string | undefined): string {
    if (!raw) return 'other';

    const r = raw.toLowerCase();

    if (r.includes('run')) return 'running';
    if (r.includes('cycl') || r.includes('bike') || r.includes('bicycl')) {
      return 'cycling';
    }
    if (r.includes('swim')) return 'swimming';
    if (r.includes('walk')) return 'walking';
    if (r.includes('hik')) return 'hiking';
    if (r.includes('strength') || r.includes('weight')) return 'strength';
    if (r.includes('yoga')) return 'yoga';
    if (r.includes('row')) return 'rowing';
    if (r.includes('ski')) return 'skiing';
    if (r.includes('skat')) return 'skating';
    if (r.includes('tennis')) return 'tennis';
    if (r.includes('football') || r.includes('soccer')) return 'football';
    if (r.includes('basket')) return 'basketball';
    if (r.includes('cardio')) return 'cardio';

    return 'other';
  }
}
