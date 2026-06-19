import {
  defineEventHandler,
  getHeaders,
  getMethod,
  getRequestURL,
  readRawBody,
} from "h3";
import { createApp } from "server";

const honoApp = createApp();

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api")) {
    return;
  }

  const method = getMethod(event);
  const url = getRequestURL(event);
  const headers = getHeaders(event) as Record<string, string>;

  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = (await readRawBody(event)) as Buffer | undefined;
  }

  return honoApp.fetch(new Request(url.toString(), { method, headers, body }));
});
