import { env } from "@trespass/env/server";
import pino from "pino";

export const logger = pino({
  level: env.LOG_LEVEL,
});
