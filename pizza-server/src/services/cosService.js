const COS = require('cos-nodejs-sdk-v5');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { createLogger } = require('../utils/logger');
const log = createLogger('COS');

let _cosClient = null;
let _lastConfigHash = '';

function configHash() {
  const s = config.storage;
  return [s.cosSecretId, s.cosSecretKey, s.cosBucket, s.cosRegion].join('|');
}

function getClient() {
  const hash = configHash();
  if (_cosClient && _lastConfigHash === hash) return _cosClient;

  _cosClient = new COS({
    SecretId: config.storage.cosSecretId,
    SecretKey: config.storage.cosSecretKey,
  });
  _lastConfigHash = hash;
  log.info('COS client (re)initialized');
  return _cosClient;
}

/**
 * Upload a local file to COS.
 * @param {string} localPath — absolute path to the temp file
 * @param {string} filename — UUID filename (e.g. "abc123.jpg")
 * @returns {Promise<string>} public HTTPS URL of the uploaded file
 */
function uploadFile(localPath, filename) {
  return new Promise((resolve, reject) => {
    const cos = getClient();
    const key = 'uploads/' + filename;
    const stat = fs.statSync(localPath);

    cos.putObject({
      Bucket: config.storage.cosBucket,
      Region: config.storage.cosRegion,
      Key: key,
      Body: fs.createReadStream(localPath),
      ContentLength: stat.size,
    }, (err, data) => {
      if (err) {
        log.error({ err, filename }, 'COS upload failed');
        return reject(err);
      }

      const baseUrl = config.storage.cosBaseUrl
        || `https://${config.storage.cosBucket}.cos.${config.storage.cosRegion}.myqcloud.com`;
      const url = baseUrl + '/' + key;
      log.info({ filename, url }, 'COS upload success');
      resolve(url);
    });
  });
}

/**
 * Delete a file from COS.
 * @param {string} urlOrKey — either full COS URL or "uploads/xxx.jpg" key
 */
function deleteFile(urlOrKey) {
  return new Promise((resolve, reject) => {
    const cos = getClient();
    let key;
    if (urlOrKey.startsWith('http')) {
      const u = new URL(urlOrKey);
      key = u.pathname.replace(/^\//, '');
    } else {
      key = urlOrKey;
    }

    cos.deleteObject({
      Bucket: config.storage.cosBucket,
      Region: config.storage.cosRegion,
      Key: key,
    }, (err) => {
      if (err) {
        log.error({ err, key }, 'COS delete failed');
        return reject(err);
      }
      log.info({ key }, 'COS delete success');
      resolve();
    });
  });
}

/**
 * Check if COS credentials are properly configured.
 */
function isConfigured() {
  return !!(config.storage.cosSecretId && config.storage.cosSecretKey
    && config.storage.cosBucket && config.storage.cosRegion);
}

module.exports = { uploadFile, deleteFile, isConfigured };
