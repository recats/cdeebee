import { isRecord } from '../utils/isRecord';
import { CdeebeeRequestError, toRequestError } from './requestError';
import type { CdeebeeFetchSettings, CdeebeeMethod, CdeebeeRequestOptions } from './types';

export interface FetchContext {
  requestID: string;
  api: string;
  url: string;
  method: CdeebeeMethod;
  data: unknown;
  headerList: Record<string, string>;
  controller: AbortController;
  options: Pick<CdeebeeRequestOptions<unknown>, 'api' | 'fileList' | 'responseType'>;
}

const isAbsolute = (api: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(api);

export function buildUrl(baseUrl: string | undefined, api: string): string {
  if (!baseUrl || isAbsolute(api)) return api;
  return `${baseUrl.replace(/\/+$/, '')}/${api.replace(/^\/+/, '')}`;
}

export function resolveHeaderList(settings: CdeebeeFetchSettings, headerList?: Record<string, string>): Record<string, string> {
  const base = typeof settings.headerList === 'function' ? settings.headerList() : (settings.headerList ?? {});
  return { ...base, ...(headerList ?? {}) };
}

export function resolveData(settings: CdeebeeFetchSettings, data: unknown): unknown {
  const base = typeof settings.mergeWithData === 'function' ? settings.mergeWithData() : (settings.mergeWithData ?? {});
  if (data === undefined) return { ...base };
  if (!isRecord(data)) return data;
  return { ...base, ...data };
}

export function buildRequestInit(ctx: FetchContext, settings: CdeebeeFetchSettings): RequestInit {
  const isGet = ctx.method === 'GET';
  const fileList = ctx.options.fileList;
  const json = JSON.stringify(ctx.data);

  let body: BodyInit | undefined;
  if (!isGet) {
    if (fileList && fileList.length > 0) {
      const form = new FormData();
      const fileKey = settings.fileKey ?? 'file';
      const bodyKey = settings.bodyKey ?? 'value';
      for (let i = 0; i < fileList.length; i += 1) form.append(fileKey, fileList[i]);
      form.append(bodyKey, json);
      body = form;
    } else {
      body = json;
    }
  }

  const headers: Record<string, string> = {};
  if (!isGet && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  Object.assign(headers, ctx.headerList);
  if (body instanceof FormData) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-type') delete headers[key];
    }
  }
  headers['ui-request-id'] = ctx.requestID;

  return { method: ctx.method, headers, signal: ctx.controller.signal, ...(body === undefined ? {} : { body }) };
}

async function parseBody(response: Response, responseType: 'json' | 'text' | 'blob'): Promise<unknown> {
  if (responseType === 'text') return response.text();
  if (responseType === 'blob') return response.blob();
  return response.json();
}

export async function executeFetch(ctx: FetchContext, settings: CdeebeeFetchSettings): Promise<{ response: unknown; status: number }> {
  const doFetch = settings.fetch ?? globalThis.fetch;
  const responseType = ctx.options.responseType ?? 'json';
  let raw: Response;

  try {
    raw = await doFetch(ctx.url, buildRequestInit(ctx, settings));
  } catch (error) {
    throw toRequestError(error, ctx);
  }

  if (!raw.ok) {
    let response: unknown;
    try {
      response = await parseBody(raw, responseType);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw toRequestError(error, ctx);
      response = undefined;
    }
    throw new CdeebeeRequestError({ kind: 'http', api: ctx.api, requestID: ctx.requestID, status: raw.status, response });
  }

  try {
    return { response: await parseBody(raw, responseType), status: raw.status };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw toRequestError(error, ctx);
    throw new CdeebeeRequestError({ kind: 'parse', api: ctx.api, requestID: ctx.requestID, status: raw.status, cause: error });
  }
}
