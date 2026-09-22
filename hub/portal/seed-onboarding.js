'use strict';

const { query } = require('../db');
const { DEFAULT_ONBOARDING_STEPS } = require('./constants');

async function seedDefaultOnboardingTrack() {
  const existing = await query(
    `SELECT id FROM onboarding_tracks WHERE is_active = true LIMIT 1`,
  );
  if (existing.rowCount) return existing.rows[0].id;

  const inserted = await query(
    `INSERT INTO onboarding_tracks (name, is_active)
     VALUES ('Trilha de Integração', true)
     RETURNING id`,
  );
  const trackId = inserted.rows[0].id;

  for (const step of DEFAULT_ONBOARDING_STEPS) {
    await query(
      `INSERT INTO onboarding_steps
        (track_id, position, title, description, target_kind, target_route, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [
        trackId,
        step.position,
        step.title,
        step.description,
        step.target_kind,
        step.target_route,
      ],
    );
  }

  console.log('[hub] trilha de onboarding seedada (8 etapas)');
  return trackId;
}

module.exports = {
  seedDefaultOnboardingTrack,
};
