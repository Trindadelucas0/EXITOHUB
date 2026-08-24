'use strict';

const { randomUUID } = require('crypto');

const sessions = new Map();

function createSession(data) {
  const id = randomUUID();
  const session = {
    id,
    createdAt: new Date().toISOString(),
    ...data,
  };
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id) || null;
}

/** Coloca/substitui sessão no mapa (ex.: reidratar do Postgres). */
function putSession(session) {
  if (!session?.id) return null;
  sessions.set(session.id, session);
  return session;
}

function updateSession(id, patch) {
  const current = sessions.get(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  sessions.set(id, next);
  return next;
}

function deleteSession(id) {
  sessions.delete(id);
}

function clearAllSessions() {
  sessions.clear();
}

module.exports = {
  createSession,
  getSession,
  putSession,
  updateSession,
  deleteSession,
  clearAllSessions,
};
