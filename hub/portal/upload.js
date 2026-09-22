'use strict';

const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const multer = require('multer');
const { query } = require('../db');
const { IMAGE_MIMES, DOC_MIMES, VIDEO_MIMES, LIMITS } = require('./constants');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'portal');

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

function extensionForMime(mime) {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'video/mp4') return '.mp4';
  return '';
}

function maxBytesForMime(mime) {
  if (IMAGE_MIMES.has(mime)) return LIMITS.imageBytes;
  if (mime === 'application/pdf') return LIMITS.pdfBytes;
  if (mime === 'video/mp4') return LIMITS.videoBytes;
  return LIMITS.imageBytes;
}

function createUploader(allowedMimes) {
  ensureUploadDir();
  const storage = multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, UPLOAD_ROOT);
    },
    filename(_req, file, cb) {
      const ext = extensionForMime(file.mimetype) || path.extname(file.originalname).slice(0, 8);
      cb(null, `${randomUUID()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: LIMITS.videoBytes },
    fileFilter(_req, file, cb) {
      const mime = String(file.mimetype || '').toLowerCase();
      if (!allowedMimes.has(mime)) {
        const err = new Error('Tipo de arquivo não permitido.');
        err.code = 'UNSUPPORTED_MEDIA';
        err.status = 415;
        return cb(err);
      }
      if (file.size && file.size > maxBytesForMime(mime)) {
        const err = new Error('Arquivo muito grande.');
        err.code = 'LIMIT_FILE_SIZE';
        err.status = 413;
        return cb(err);
      }
      return cb(null, true);
    },
  });
}

const uploadImage = createUploader(IMAGE_MIMES);
const uploadDoc = createUploader(DOC_MIMES);
const uploadMedia = createUploader(VIDEO_MIMES);

async function saveUploadedFile(file, userId) {
  if (!file) return null;
  const mime = String(file.mimetype || '').toLowerCase();
  const max = maxBytesForMime(mime);
  if (file.size > max) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {
      /* ignore */
    }
    const err = new Error('Arquivo muito grande.');
    err.status = 413;
    throw err;
  }
  const storedName = path.basename(file.path);
  if (storedName.includes('..') || storedName.includes('/') || storedName.includes('\\')) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {
      /* ignore */
    }
    throw new Error('Nome de arquivo inválido.');
  }
  const result = await query(
    `INSERT INTO portal_files (stored_path, original_name, mime, size_bytes, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, stored_path, original_name, mime, size_bytes, created_at`,
    [storedName, String(file.originalname || storedName).slice(0, 255), mime, file.size, userId || null],
  );
  return result.rows[0];
}

async function getFileById(fileId) {
  const id = String(fileId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const result = await query(
    `SELECT id, stored_path, original_name, mime, size_bytes, created_at
     FROM portal_files WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

function absolutePathForStored(storedPath) {
  const base = path.resolve(UPLOAD_ROOT);
  const resolved = path.resolve(UPLOAD_ROOT, path.basename(String(storedPath || '')));
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    return null;
  }
  return resolved;
}

function mediaUrl(fileId) {
  if (!fileId) return null;
  return `/portal/media/${fileId}`;
}

module.exports = {
  UPLOAD_ROOT,
  ensureUploadDir,
  uploadImage,
  uploadDoc,
  uploadMedia,
  saveUploadedFile,
  getFileById,
  absolutePathForStored,
  mediaUrl,
};
