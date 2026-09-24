'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { query } = require('../db');
const { UPLOAD_ROOT, ensureUploadDir } = require('./upload');

const SEED_DIR = path.join(__dirname, 'seed-assets', 'contents');

const EXAMPLE_TITLES = [
  'Bem-vindo ao Êxito',
  'Nossa equipe',
  'Informações internas',
  'Novidades do Êxito',
];

const ORIGINAL_CONTENT = {
  file: 'principal.jpg',
  title: 'TESTE TESTE TESTE TESTE TESTE TESTE TESTE TESTE TESTE TESTE TESTE TESTE',
  description: 'TESTE TESTE TESTE TESTE TESTE TESTE',
  category: 'Empresa',
  sort_order: 2,
};

async function removeExampleContents() {
  const existing = await query(
    `SELECT c.id, c.image_file_id, f.stored_path
     FROM portal_contents c
     LEFT JOIN portal_files f ON f.id = c.image_file_id
     WHERE c.title = ANY($1::text[])
       AND c.description LIKE 'Foto de exemplo%'`,
    [EXAMPLE_TITLES],
  );
  if (!existing.rowCount) return 0;

  for (const row of existing.rows) {
    await query(`DELETE FROM portal_contents WHERE id = $1`, [row.id]);
    if (!row.image_file_id) continue;

    const stillUsed = await query(
      `SELECT 1 FROM portal_contents WHERE image_file_id = $1
       UNION ALL
       SELECT 1 FROM portal_contacts WHERE photo_file_id = $1
       UNION ALL
       SELECT 1 FROM portal_items WHERE file_id = $1 OR thumbnail_file_id = $1
       UNION ALL
       SELECT 1 FROM hub_users WHERE photo_file_id = $1
       UNION ALL
       SELECT 1 FROM onboarding_steps WHERE pdf_file_id = $1
       LIMIT 1`,
      [row.image_file_id],
    );
    if (stillUsed.rowCount) continue;

    await query(`DELETE FROM portal_files WHERE id = $1`, [row.image_file_id]);
    if (row.stored_path) {
      const filePath = path.join(UPLOAD_ROOT, path.basename(row.stored_path));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  console.log(`[hub] Conteúdos de exemplo removidos (${existing.rowCount})`);
  return existing.rowCount;
}

async function seedOriginalContent() {
  const existing = await query(`SELECT id FROM portal_contents LIMIT 1`);
  if (existing.rowCount) return false;

  const source = path.join(SEED_DIR, ORIGINAL_CONTENT.file);
  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo de conteúdo ausente: ${ORIGINAL_CONTENT.file}`);
  }

  ensureUploadDir();
  const storedName = `${randomUUID()}.jpg`;
  const dest = path.join(UPLOAD_ROOT, storedName);
  fs.copyFileSync(source, dest);
  const sizeBytes = fs.statSync(dest).size;

  const fileRow = await query(
    `INSERT INTO portal_files (stored_path, original_name, mime, size_bytes, created_by)
     VALUES ($1, $2, 'image/jpeg', $3, NULL)
     RETURNING id`,
    [storedName, ORIGINAL_CONTENT.file, sizeBytes],
  );

  await query(
    `INSERT INTO portal_contents
      (title, description, image_file_id, category, target_type, target_url, target_route,
       is_published, show_on_home, sort_order, published_at)
     VALUES ($1, $2, $3, $4, 'none', NULL, NULL, true, true, $5, NOW())`,
    [
      ORIGINAL_CONTENT.title,
      ORIGINAL_CONTENT.description,
      fileRow.rows[0].id,
      ORIGINAL_CONTENT.category,
      ORIGINAL_CONTENT.sort_order,
    ],
  );

  console.log('[hub] Conteúdo Êxito original restaurado (principal.jpg)');
  return true;
}

async function seedDefaultContents() {
  await removeExampleContents();
  return seedOriginalContent();
}

module.exports = {
  seedDefaultContents,
  removeExampleContents,
};
