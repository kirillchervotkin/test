// src/training/entities/types/training-session.types.ts

import { createHash } from 'node:crypto';

/**
 * Внутреннее представление тренировки.
 *
 * Первичный ключ — составной: (userId, provider, externalId).
 * Поле `id` — суррогатный детерминированный хеш от этих трёх
 * значений (SHA-256, 32 hex-символа). Используется как ссылка
 * из `training_samples.session_id` и не участвует в PK.
 *
 * Детерминированность `id` критична для идемпотентности:
 * повторная обработка одного и того же события (вебхук или
 * backfill) даёт тот же `id`, и upsert перезаписывает строку,
 * а не создаёт дубликат.
 *
 * Провайдер-специфичные поля здесь ОТСУТСТВУЮТ. Всё, что
 * приходит из Polar/Suunto, адаптер приводит к этому
 * каноническому виду ДО записи в БД.
 */
export interface TrainingSession {
  // ── Идентификация ──
  userId: string;
  provider: string; // 'polar' | 'suunto' | ...
  externalId: string; // ID тренировки у провайдера
  id: string; // детерминированный хеш

  // ── Время ──
  startTime: Date;
  durationSec: number;

  // ── Спорт ──
  sport: string | null; // нормализованный код ('running', ...)

  // ── Основные метрики ──
  distanceM: number | null;
  calories: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  hrMin: number | null;

  // ── Рельеф ──
  ascentM: number | null;
  descentM: number | null;

  // ── Пользовательские поля ──
  name: string | null; // отображаемое имя, редактируется в Arbitrator
  notes: string | null; // заметки пользователя Arbitrator
}

/**
 * Данные для создания/upsert тренировки из провайдера.
 *
 * Отличается от `TrainingSession` двумя моментами:
 *
 *   1. Нет `id` — он вычисляется в репозитории как
 *      deterministicHash(userId, provider, externalId). Выносить
 *      это в вызывающий код не нужно.
 *
 *   2. Все метрические поля ОПЦИОНАЛЬНЫ. Провайдер может не
 *      присылать часть данных (например, Suunto не отдаёт hrMin
 *      для некоторых типов тренировок). Нерелевантные поля
 *      отсутствуют в объекте (не передаются как null), чтобы
 *      Drizzle не включал их в INSERT/UPDATE.
 *
 *      Это критично для YDB: явный `null` в параметрах запроса
 *      драйвер пытается сериализовать как protobuf `null_type`,
 *      который YDB не поддерживает. Если ключа в объекте нет —
 *      колонка в SQL не попадает, и БД подставляет NULL
 *      по умолчанию.
 *
 *   3. `name` и `notes` тоже опциональны. Если провайдер их не
 *      присылает (Polar обычно присылает пустые строки), они не
 *      передаются в INSERT. Это защищает пользовательские
 *      значения от затирания при повторной обработке: адаптер
 *      НЕ передаёт name/notes, если провайдер их не дал, и
 *      существующие значения в БД остаются нетронутыми.
 */
export interface CreateTrainingSessionData {
  // ── Идентификация (без id) ──
  userId: string;
  provider: string;
  externalId: string;

  // ── Обязательные ──
  startTime: Date;
  durationSec: number;

  // ── Опциональные метрики ──
  sport?: string;
  distanceM?: number;
  calories?: number;
  hrAvg?: number;
  hrMax?: number;
  hrMin?: number;
  ascentM?: number;
  descentM?: number;

  // ── Пользовательские (только если провайдер их дал) ──
  name?: string;
  notes?: string;
}

/**
 * Данные для частичного обновления тренировки.
 *
 * Используется ТОЛЬКО для редактирования пользователем. Провайдер
 * сюда не пишет. Обновляемые поля ограничены: name, notes, sport.
 * Метрики (distance, hr, calories, ...) и время неизменны после
 * записи — если провайдер их прислал, они попадают в upsert
 * через `CreateTrainingSessionData`.
 *
 * Все поля опциональны. Отсутствие ключа означает «не трогать
 * колонку». Значение `null` допускается только для name/notes
 * и означает «очистить» (пользователь удалил имя или заметку).
 */
export interface UpdateTrainingSessionData {
  name?: string | null;
  notes?: string | null;
  sport?: string | null;
}

// ---------------------------------------------------------------------------
// Справочник провайдеров
// ---------------------------------------------------------------------------

/**
 * Известные провайдеры тренировок.
 *
 * Список не закрытый — добавление нового провайдера не требует
 * миграции, потому что колонка `provider` в БД — Utf8.
 * Тип-юнион используется для type-safety в коде адаптеров.
 */
export type TrainingProvider = 'polar' | 'suunto' | 'garmin';

/**
 * Известные нормализованные виды спорта.
 *
 * Хранятся в отдельной таблице `sport_types` для UI,
 * но в `training_sessions.sport` пишется строка — именно этот
 * юнион используется при нормализации.
 *
 * Если провайдер присылает что-то не из списка, адаптер
 * приводит значение к 'other'. Расширять юнион нужно синхронно
 * с добавлением записи в `sport_types`.
 */
export type SportCode =
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'walking'
  | 'hiking'
  | 'strength'
  | 'cardio'
  | 'yoga'
  | 'rowing'
  | 'skiing'
  | 'skating'
  | 'tennis'
  | 'football'
  | 'basketball'
  | 'other';

/**
 * Детерминированный ID тренировки.
 *
 * SHA-256 от конкатенации (userId | provider | externalId),
 * обрезанный до 32 hex-символов (128 бит). Коллизии
 * исключены для практических объёмов.
 *
 * Вынесено в отдельную функцию, потому что этот же хеш
 * используется как `training_samples.session_id` — он должен
 * вычисляться ОДИНАКОВО в обоих репозиториях.
 *
 * Разделитель `|` обязателен: без него конкатенация
 * ('ab', 'c', 'd') и ('a', 'bc', 'd') дала бы одинаковый хеш.
 */
export function makeSessionId(
  userId: string,
  provider: string,
  externalId: string,
): string {
  return createHash('sha256')
    .update(`${userId}|${provider}|${externalId}`)
    .digest('hex')
    .slice(0, 32);
}
