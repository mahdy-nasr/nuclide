'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.__test__ = exports.clearConnectionConfig = exports.setConnectionConfig = exports.getConnectionConfig = exports.SERVER_CONFIG_REQUEST_EVENT = exports.SERVER_CONFIG_RESPONSE_EVENT = undefined;var _asyncToGenerator = _interopRequireDefault(require('async-to-generator'));let getConnectionConfigViaIPC = (() => {var _ref = (0, _asyncToGenerator.default)(





























































  function* (
  host)
  {
    const thisWindowsId = remote.getCurrentWindow().id;
    const otherWindows = remote.BrowserWindow.getAllWindows().filter(
    function (win) {return win.isVisible() && win.id !== thisWindowsId;});

    const timeoutInMilliseconds = 5000;

    return new Promise(function (resolve) {
      if (otherWindows.length === 0) {
        resolve(null);
        return;
      }

      let responseCount = 0;

      // set a timeout to remove all listeners and resolve if
      // we don't get responses in some fixed amount of time
      const timeout = setTimeout(function () {
        logger.error('timed out waiting for ipc response(s) from other windows');
        resolve(null);
        ipc.removeAllListeners(SERVER_CONFIG_RESPONSE_EVENT);
      }, timeoutInMilliseconds);

      ipc.on(
      SERVER_CONFIG_RESPONSE_EVENT,
      function (event, config) {
        responseCount++;

        if (config != null || responseCount === otherWindows.length) {
          if (config != null) {
            logger.info('received the config! removing other listeners');
          }
          resolve(config);
          clearTimeout(timeout);
          ipc.removeAllListeners(SERVER_CONFIG_RESPONSE_EVENT);
        }
      });


      otherWindows.forEach(function (window) {
        logger.info(`requesting config from window ${window.id}`);

        // NOTE: I tried using sendTo here but it wasn't working well
        // (seemed like it was flaky). It might be worth trying it
        // again after we upgrade electron
        window.send(SERVER_CONFIG_REQUEST_EVENT, host, thisWindowsId);
      });
    });
  });return function getConnectionConfigViaIPC(_x) {return _ref.apply(this, arguments);};})();let getConnectionConfig = exports.getConnectionConfig = (() => {var _ref2 = (0, _asyncToGenerator.default)(

  function* (
  host)
  {
    const storedConfig = localStorage.getItem(getStorageKey(host));
    if (storedConfig == null) {
      return null;
    }
    try {
      return yield decryptConfig(JSON.parse(storedConfig));
    } catch (e) {
      logger.error(`The configuration file for ${host} is corrupted.`, e);

      logger.info('falling back to getting the config via ipc');
      const config = yield getConnectionConfigViaIPC(host);

      return config;
    }
  });return function getConnectionConfig(_x2) {return _ref2.apply(this, arguments);};})();let setConnectionConfig = exports.setConnectionConfig = (() => {var _ref3 = (0, _asyncToGenerator.default)(

  function* (
  config,
  ipAddress)
  {
    // Don't attempt to store insecure connections.
    // Insecure connections are used for testing and will fail the encryption call below.
    if (isInsecure(config)) {
      return;
    }

    try {
      const encrypted = JSON.stringify((yield encryptConfig(config)));
      localStorage.setItem(getStorageKey(config.host), encrypted);
      // Store configurations by their IP address as well.
      // This way, multiple aliases for the same hostname can reuse a single connection.
      localStorage.setItem(getStorageKey(ipAddress), encrypted);
    } catch (e) {
      logger.error(`Failed to store configuration file for ${config.host}.`, e);
    }
  });return function setConnectionConfig(_x3, _x4) {return _ref3.apply(this, arguments);};})();let clearConnectionConfig = exports.clearConnectionConfig = (() => {var _ref4 = (0, _asyncToGenerator.default)(

  function* (host) {
    try {
      localStorage.removeItem(getStorageKey(host));
    } catch (e) {
      logger.error(`Failed to clear configuration for ${host}.`, e);
    }
  });return function clearConnectionConfig(_x5) {return _ref4.apply(this, arguments);};})();

/**
                                                                                              * Encrypts the clientKey of a ConnectionConfig.
                                                                                              * @param remoteProjectConfig - The config with the clientKey we want encrypted.
                                                                                              * @return returns the passed in config with the clientKey encrypted.
                                                                                              */let encryptConfig = (() => {var _ref5 = (0, _asyncToGenerator.default)(
  function* (
  remoteProjectConfig)
  {
    const sha1 = _crypto.default.createHash('sha1');
    sha1.update(`${remoteProjectConfig.host}:${remoteProjectConfig.port}`);
    const sha1sum = sha1.digest('hex');

    const {
      certificateAuthorityCertificate,
      clientCertificate,
      clientKey } =
    remoteProjectConfig;if (!
    clientKey) {throw new Error('Invariant violation: "clientKey"');}
    const realClientKey = clientKey.toString(); // Convert from Buffer to string.
    const { salt, password, encryptedString } = encryptString(realClientKey);
    yield (_keytarWrapper || _load_keytarWrapper()).default.replacePassword(
    'nuclide.remoteProjectConfig',
    sha1sum,
    password);


    const clientKeyWithSalt = encryptedString + '.' + salt;if (!

    certificateAuthorityCertificate) {throw new Error('Invariant violation: "certificateAuthorityCertificate"');}if (!
    clientCertificate) {throw new Error('Invariant violation: "clientCertificate"');}

    return {
      host: remoteProjectConfig.host,
      port: remoteProjectConfig.port,
      family: remoteProjectConfig.family,
      certificateAuthorityCertificate: certificateAuthorityCertificate.toString(),
      clientCertificate: clientCertificate.toString(),
      clientKey: clientKeyWithSalt,
      version: remoteProjectConfig.version };

  });return function encryptConfig(_x6) {return _ref5.apply(this, arguments);};})();

/**
                                                                                      * Decrypts the clientKey of a SerializableServerConnectionConfiguration.
                                                                                      * @param remoteProjectConfig - The config with the clientKey we want encrypted.
                                                                                      * @return returns the passed in config with the clientKey encrypted.
                                                                                      */let decryptConfig = (() => {var _ref6 = (0, _asyncToGenerator.default)(
  function* (
  remoteProjectConfig)
  {
    const sha1 = _crypto.default.createHash('sha1');
    sha1.update(`${remoteProjectConfig.host}:${remoteProjectConfig.port}`);
    const sha1sum = sha1.digest('hex');

    const password = yield (_keytarWrapper || _load_keytarWrapper()).default.getPassword(
    'nuclide.remoteProjectConfig',
    sha1sum);


    if (password == null) {
      throw new Error('Cannot find password for encrypted client key');
    }

    const {
      certificateAuthorityCertificate,
      clientCertificate,
      clientKey } =
    remoteProjectConfig;
    // flowlint-next-line sketchy-null-string:off
    if (!clientKey) {throw new Error('Invariant violation: "clientKey"');}
    const [encryptedString, salt] = clientKey.split('.');

    if (!encryptedString || !salt) {
      throw new Error('Cannot decrypt client key');
    }

    const restoredClientKey = decryptString(encryptedString, password, salt);
    if (
    // @lint-ignore PRIVATEKEY1
    !restoredClientKey.startsWith('-----BEGIN RSA PRIVATE KEY-----'))
    {
      (0, (_log4js || _load_log4js()).getLogger)('nuclide-remote-connection').error(
      `decrypted client key did not start with expected header: ${restoredClientKey}`);

    }

    // flowlint-next-line sketchy-null-string:off
    if (!certificateAuthorityCertificate) {throw new Error('Invariant violation: "certificateAuthorityCertificate"');}
    // flowlint-next-line sketchy-null-string:off
    if (!clientCertificate) {throw new Error('Invariant violation: "clientCertificate"');}
    return {
      host: remoteProjectConfig.host,
      port: remoteProjectConfig.port,
      family: remoteProjectConfig.family,
      certificateAuthorityCertificate: new Buffer(
      certificateAuthorityCertificate),

      clientCertificate: new Buffer(clientCertificate),
      clientKey: new Buffer(restoredClientKey),
      version: remoteProjectConfig.version };

  });return function decryptConfig(_x7) {return _ref6.apply(this, arguments);};})();var _crypto = _interopRequireDefault(require('crypto'));var _log4js;function _load_log4js() {return _log4js = require('log4js');}var _keytarWrapper;function _load_keytarWrapper() {return _keytarWrapper = _interopRequireDefault(require('../../commons-node/keytarWrapper'));}var _electron = _interopRequireDefault(require('electron'));function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}const CONFIG_DIR = 'nuclide-connections'; /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         * Copyright (c) 2015-present, Facebook, Inc.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         * All rights reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         * This source code is licensed under the license found in the LICENSE file in
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         * the root directory of this source tree.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         *  strict-local
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         * @format
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         */ /* global localStorage */const logger = (0, (_log4js || _load_log4js()).getLogger)('nuclide-remote-connection');const remote = _electron.default.remote;const ipc = _electron.default.ipcRenderer;if (!remote) {throw new Error('Invariant violation: "remote"');}if (!ipc) {throw new Error('Invariant violation: "ipc"');}const SERVER_CONFIG_RESPONSE_EVENT = exports.SERVER_CONFIG_RESPONSE_EVENT = 'server-config-response';const SERVER_CONFIG_REQUEST_EVENT = exports.SERVER_CONFIG_REQUEST_EVENT = 'server-config-request'; /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 * Version of ServerConnectionConfiguration that uses string instead of Buffer for fields so it can
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 * be translated directly to/from JSON.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 */ // Insecure configs are used for testing only.
function isInsecure(config) {return config.clientKey == null && config.clientCertificate == null && config.certificateAuthorityCertificate == null;}function getStorageKey(host) {return `${CONFIG_DIR}:${host}`;}function decryptString(text, password, salt) {const decipher = _crypto.default.createDecipheriv('aes-128-cbc', new Buffer(password, 'base64'), new Buffer(salt, 'base64'));let decryptedString = decipher.update(text, 'base64', 'utf8');decryptedString += decipher.final('utf8');return decryptedString;}

function encryptString(
text)
{
  const password = _crypto.default.randomBytes(16).toString('base64');
  const salt = _crypto.default.randomBytes(16).toString('base64');

  const cipher = _crypto.default.createCipheriv(
  'aes-128-cbc',
  new Buffer(password, 'base64'),
  new Buffer(salt, 'base64'));


  let encryptedString = cipher.update(
  text,
  /* input_encoding */'utf8',
  /* output_encoding */'base64');

  encryptedString += cipher.final('base64');

  return {
    password,
    salt,
    encryptedString };

}

const __test__ = exports.__test__ = {
  decryptString,
  encryptString };