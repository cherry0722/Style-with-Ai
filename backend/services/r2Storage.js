/**
 * Cloudflare R2 storage via S3-compatible API.
 * All credentials from process.env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL.
 */
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'];

const RAW_PREFIX = (process.env.RAW_R2_PREFIX || 'raw/').replace(/\/?$/, '/');
const CLEAN_PREFIX = (process.env.CLEAN_R2_PREFIX || 'clean/').replace(/\/?$/, '/');

function getConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }

  // S3 API endpoint only; do NOT use R2_PUBLIC_BASE_URL (.r2.dev) as endpoint
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  return {
    endpoint,
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
    bucket,
    publicBaseUrl,
  };
}

let cachedClient = null;

function getClient() {
  if (cachedClient) return cachedClient;
  const config = getConfig();
  if (!config) return null;
  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: config.credentials,
    forcePathStyle: true,
  });
  return cachedClient;
}

/**
 * Upload a buffer to R2 and return the public URL.
 * @param {Object} opts
 * @param {Buffer} opts.buffer
 * @param {string} opts.contentType - e.g. image/jpeg, image/png
 * @param {string} opts.key - object key, e.g. images/1234567890-abc.jpg
 * @returns {Promise<string>} public URL
 * @throws if config missing or upload fails
 */
async function uploadBuffer({ buffer, contentType, key }) {
  const config = getConfig();
  if (!config) {
    const missing = REQUIRED_ENV.filter((k) => !process.env[k] || !String(process.env[k]).trim());
    const err = new Error(`R2 config missing: set ${missing.length ? missing.join(', ') : REQUIRED_ENV.join(', ')}`);
    err.code = 'R2_CONFIG_MISSING';
    throw err;
  }

  console.log('[R2] endpoint=', config.endpoint, 'bucket=', config.bucket);

  const client = getClient();
  if (!client) {
    const err = new Error('R2 client unavailable');
    err.code = 'R2_CLIENT_UNAVAILABLE';
    throw err;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    })
  );

  const publicUrl = `${config.publicBaseUrl}/${key}`;
  return publicUrl;
}

/**
 * Upload a buffer to R2. Alias for uploadBuffer with consistent naming.
 * @param {Object} opts
 * @param {string} opts.key - object key
 * @param {Buffer} opts.buffer
 * @param {string} opts.contentType
 * @returns {Promise<string>} public URL
 */
async function uploadBufferToR2({ key, buffer, contentType }) {
  return uploadBuffer({ buffer, contentType, key });
}

/**
 * Delete an object from R2.
 * @param {Object} opts
 * @param {string} opts.key - object key to delete
 * @returns {Promise<void>}
 * @throws if config missing; logs warning on delete failure (best-effort)
 */
async function deleteFromR2({ key }) {
  const config = getConfig();
  if (!config) {
    const missing = REQUIRED_ENV.filter((k) => !process.env[k] || !String(process.env[k]).trim());
    const err = new Error(`R2 config missing: set ${missing.length ? missing.join(', ') : REQUIRED_ENV.join(', ')}`);
    err.code = 'R2_CONFIG_MISSING';
    throw err;
  }
  const client = getClient();
  if (!client) throw new Error('R2 client unavailable');
  try {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    console.log('[R2] Deleted object:', key);
  } catch (err) {
    console.warn('[R2] Delete failed (best-effort):', key, err.message);
  }
}

/**
 * Infer file extension from MIME type. v1: jpeg, jpg, png, webp only.
 * @param {string} mimetype
 * @returns {string}
 */
function extFromMimetype(mimetype) {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mimetype] || 'jpg';
}

/**
 * Generate a raw object key: raw/<userId>/<timestamp>_<random>.<ext>
 * @param {string} userId
 * @param {string} mimetype
 * @returns {{ key: string, ext: string }}
 */
function generateRawKey(userId, mimetype) {
  const ext = extFromMimetype(mimetype);
  const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'anon';
  const key = `${RAW_PREFIX}${safeUserId}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
  return { key, ext };
}

module.exports = {
  uploadBuffer,
  uploadBufferToR2,
  deleteFromR2,
  extFromMimetype,
  generateRawKey,
  getConfig,
  RAW_PREFIX,
  CLEAN_PREFIX,
};
