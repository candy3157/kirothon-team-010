import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { SampleShowtimeProvider } from '../../src/data/provider.js';
import { MockRouteProvider, type MockRouteOptions } from '../../src/routing/mock.js';
import { ResultStore } from '../../src/services/resultStore.js';
import type { ShowtimeProvider } from '../../src/data/provider.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DOCS_DIR = join(here, '..', '..', '..', 'docs');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const spec: any = parse(readFileSync(join(DOCS_DIR, 'openapi.yaml'), 'utf8'));

// OpenAPI 3.1의 스키마는 JSON Schema 2020-12이므로 문서 전체를 루트로 등록하고 #/components/schemas/X로 참조한다.
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(spec, 'oas');

export function validator(name: string) {
  const v = ajv.getSchema(`oas#/components/schemas/${name}`);
  if (!v) throw new Error(`스키마 없음: ${name}`);
  return v;
}

export function check(name: string, data: unknown): string[] {
  const v = validator(name);
  return v(data) ? [] : (v.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);
}

/** 명세에 선언된 응답 상태 코드인지 확인한다. */
export function declaredStatuses(path: string, method: string): string[] {
  return Object.keys(spec.paths[path][method].responses);
}

export function readExample(file: string): unknown {
  return JSON.parse(readFileSync(join(DOCS_DIR, 'examples', file), 'utf8'));
}

export function exampleFiles(): string[] {
  return readdirSync(join(DOCS_DIR, 'examples')).filter((f) => f.endsWith('.json'));
}

export const BASE_NOW = '2026-11-14T14:00:00+09:00';

export interface Harness {
  app: FastifyInstance;
  routes: MockRouteProvider;
  setNow(iso: string): void;
}

export function makeApp(
  routeOpts: MockRouteOptions = { fixedMinutes: { cin_gangnam: { transit: 25 }, cin_suwon: { transit: 65 }, cin_jamsil: { transit: 30 } } },
  over: { provider?: (now: () => Date) => ShowtimeProvider; frontendOrigins?: string[] } = {},
): Harness {
  let current = new Date(BASE_NOW);
  const now = () => current;
  const routes = new MockRouteProvider(routeOpts);
  const app = buildApp(
    {},
    {
      provider: over.provider ? over.provider(now) : new SampleShowtimeProvider({ now }),
      now,
      routes,
      store: new ResultStore({ now }),
      ...(over.frontendOrigins ? { frontendOrigins: over.frontendOrigins } : {}),
    },
  );
  return { app, routes, setNow: (iso) => void (current = new Date(iso)) };
}

export const requestBody = (over: Record<string, unknown> = {}) => ({
  movieId: 'movie_001',
  origin: { latitude: 37.5, longitude: 127.03 },
  transportMode: 'transit',
  departureTime: BASE_NOW,
  ...over,
});
