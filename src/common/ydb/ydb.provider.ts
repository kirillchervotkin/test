import { Driver } from '@ydbjs/core';
import { query } from '@ydbjs/query';
import { ServiceAccountCredentialsProvider } from '@ydbjs/auth-yandex-cloud';
// Импортируем YdbDriver и createDrizzle из адаптера
import { YdbDriver, createDrizzle } from '@ydbjs/drizzle-adapter';
import { readFileSync } from 'fs';
import { YDB_DRIVER, YDB_SQL, DRIZZLE } from './ydb.constants.js';

// Старый провайдер для Driver (используется в старых репозиториях)
export const ydbDriverProvider = {
  provide: YDB_DRIVER,
  useFactory: async (): Promise<Driver> => {
    const endpoint = process.env.YDB_ENDPOINT;
    const database = process.env.YDB_DATABASE;
    const saKeyFile = process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS;

    if (!endpoint || !database) {
      throw new Error('YDB_ENDPOINT and YDB_DATABASE must be set');
    }
    if (!saKeyFile) {
      throw new Error(
        'YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS must be set (path to key.json)',
      );
    }

    const keyJson = readFileSync(saKeyFile, 'utf-8');
    const serviceAccountKey = JSON.parse(keyJson) as {
      private_key: string;
      id: string;
      service_account_id: string;
    };

    const connectionString = `${endpoint}${database}`;

    const driver = new Driver(connectionString, {
      credentialsProvider: new ServiceAccountCredentialsProvider(
        serviceAccountKey,
      ),
    });

    const signal = AbortSignal.timeout(10000);
    await driver.ready(signal);

    return driver;
  },
};

// Старый провайдер для SQL (используется в старых репозиториях)
export const ydbSqlProvider = {
  provide: YDB_SQL,
  useFactory: (driver: Driver) => query(driver),
  inject: [YDB_DRIVER],
};

// ИСПРАВЛЕННЫЙ провайдер для Drizzle
export const drizzleProvider = {
  provide: DRIZZLE,
  useFactory: (driver: Driver) => {
    // Оборачиваем SDK Driver в YdbDriver от адаптера
    const ydbDriver = new YdbDriver(driver);
    // Создаём Drizzle клиент, передавая YdbDriver в опции client
    return createDrizzle({ client: ydbDriver });
  },
  inject: [YDB_DRIVER],
};
