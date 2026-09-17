import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { mappingStorage } from './context.js';

@Injectable()
export class MappingMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    const context = {
      columnMapping: {},
      validationMessages: {},
    };

    mappingStorage.run(context, () => {
      next();
    });
  }
}
