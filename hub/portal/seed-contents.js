'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { query } = require('../db');
const { UPLOAD_ROOT, ensureUploadDir } = require('./upload');

const SEED_DIR = path.join(__dirname, 'seed-assets', 'contents');

const SEED_CONTENTS = [
  {
    file: 'empresa.jpg',
    title: 'Bem-vindo ao Êxito',
    description: 'Foto de exemplo. Troque imagem, título e texto em Conteúdos Êxito.',
    category: 'Empresa',
    sort_order: 1,
  },
  {
    file: 'equipe.jpg',
    title: 'Nossa equipe',
    description: 'Foto de exemplo. Substitua pela foto real da equipe.',
    category: 'Equipe',
    sort_order: 2,
  },
  {
    file: 'informacoes.jpg',
    title: 'Informações internas',
    description: 'Foto de exemplo. Use para avisos e orientações.',
    category: 'Informações',
    sort_order: 3,
  },
  {
    file: 'novidades.jpg',
    title: 'Novidades do Êxito',
    description: 'Foto de exemplo. Troque quando houver uma novidade real.',
    category: 'Novidades',
    sort_order: 4,
  },
];

async function seedDefaultContents() {
  const existing = await query(`SELECT id FROM portal_contents LIMIT 1`);
  if (existing.rowCount) return false;

  ensureUploadDir();

  for (const item of SEED_CONTENTS) {
    const source = path.join(SEED_DIR, item.file);
    if (!fs.existsSync(source)) {
      throw new Error(`Arquivo de seed ausente: ${item.file}`);
    }

    const storedName = `${randomUUID()}.jpg`;
    const dest = path.join(UPLOAD_ROOT, storedName);
    fs.copyFileSync(source, dest);
    const sizeBytes = fs.statSync(dest).size;

    const fileRow = await query(
      `INSERT INTO portal_files (stored_path, original_name, mime, size_bytes, created_by)
       VALUES ($1, $2, 'image/jpeg', $3, NULL)
       RETURNING id`,
      [storedName, item.file, sizeBytes],
    );
    const imageFileId = fileRow.rows[0].id;

    await query(
      `INSERT INTO portal_contents
        (title, description, image_file_id, category, target_type, target_url, target_route,
         is_published, show_on_home, sort_order, published_at)
       VALUES ($1, $2, $3, $4, 'none', NULL, NULL, true, true, $5, NOW())`,
      [item.title, item.description, imageFileId, item.category, item.sort_order],
    );
  }

  console.log(`[hub] Conteúdos Êxito seedados (${SEED_CONTENTS.length} exemplos)`);
  return true;
}

module.exports = {
  seedDefaultContents,
};
