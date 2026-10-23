import type { Db } from '../config/database';
import type { Env } from '../config/env';
import type { RedisLike } from '../config/redis';
import type { Mailer } from '../services/mailer';
import type { Logger } from '../utils/logger';

/** Everything the HTTP layer needs. Injected so tests can supply doubles. */
export interface AppDependencies {
  env: Env;
  db: Db;
  redis: RedisLike;
  mailer: Mailer;
  logger: Logger;
}
