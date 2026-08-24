'use strict';

const { randomUUID } = require('crypto');

const jobs = new Map();
const TTL_MS = 1000 * 60 * 30;

function cleanup() {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.updatedAt > TTL_MS) jobs.delete(id);
  }
}

function createJob() {
  cleanup();
  const id = randomUUID();
  const job = {
    id,
    percent: 0,
    step: 'Iniciando…',
    done: false,
    error: null,
    revisaoUrl: null,
    updatedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: Date.now() });
  return job;
}

function getJob(id) {
  cleanup();
  return jobs.get(id) || null;
}

function publicJob(job) {
  if (!job) return null;
  return {
    jobId: job.id,
    percent: job.percent,
    step: job.step,
    done: job.done,
    error: job.error,
    revisaoUrl: job.revisaoUrl,
  };
}

module.exports = {
  createJob,
  updateJob,
  getJob,
  publicJob,
};
