/**
 * Cloudflare R2 storage via S3-compatible API.
 * All credentials from process.env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL.
 */
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'];

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

module.exports = {
  uploadBuffer,
  getConfig,
};
