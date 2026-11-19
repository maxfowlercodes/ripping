// Which background job is the current async call chain working for? Lets deep code (the Claude runner) notice a Cancel
// without every function having to pass the job id around.
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { home, readJson } from './util.mjs';

const als = new AsyncLocalStorage();
export const inJob = (id, fn) => als.run({ id }, fn);
export const currentJobId = () => als.getStore()?.id || null;
export function isCancelled() { const id = currentJobId(); if (!id) return false; const j = readJson(path.join(home(), 'jobs', id + '.json'), null); return !!(j && j.cancel); }
