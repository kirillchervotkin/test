import { Global, Module } from '@nestjs/common';
import {
  drizzleProvider,
  ydbDriverProvider,
  ydbSqlProvider,
} from './ydb.provider.js';
import { YdbRowMapper } from './ydb-row.mapper.js';
import { YdbTypeMapper } from './ydb-type.mapper.js';

@Global()
@Module({
  providers: [
    ydbDriverProvider,
    ydbSqlProvider,
    YdbRowMapper,
    YdbTypeMapper,
    drizzleProvider,
  ],
  exports: [
    ydbDriverProvider,
    ydbSqlProvider,
    YdbRowMapper,
    YdbTypeMapper,
    drizzleProvider,
  ],
})
export class YdbModule {}
