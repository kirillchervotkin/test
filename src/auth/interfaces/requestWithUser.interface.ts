import { Payload } from './payload.interface.js';
import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: Payload;
}
