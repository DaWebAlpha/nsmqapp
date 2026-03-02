/** 
*--------------------------------------------------------------------------
* MODULE: ENTERPRISE LOGGING ENGINE
*--------------------------------------------------------------------------
* 
* @module src/core/logger
* @description Multi-stream Pino configuration with worker thread isolation.
* @compliance NIST AU-4, SOC2, GDPR (PII Redaction)
* 
* RESPONSIBILITIES:
* 1. Offload log I/O to separate threads via pino.transport.
* 2. Enforce strict data isolation (Audit vs. Access vs. System).
* 3. Scrub sensitive metadata via pino-redact.
*--------------------------------------------------------------------------
*/

import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/config.js';

/** 
*--------------------------------------------------------------------------
* LOG LEVEL & ENVIRONMENT CONFIGURATION
*--------------------------------------------------------------------------
* 
* @constant {boolean} isDevelopment - Detection of non-production environment.
* @constant {string} logLevel - Calculated threshold for log verbosity.
* 
* Logic:
* - Defaults to 'info' to optimize disk I/O in high-traffic production.
* - Overrides to 'debug' in development for granular execution tracing.
*----------------------------------------------------------------------------
*/
const isDevelopment = config.node_env === 'development'; 
const logLevel = config.log_level || (isDevelopment ? 'debug' : 'info'); 

/** 
*--------------------------------------------------------------------------
* LOGGING DIRECTORY PROVISIONING
*--------------------------------------------------------------------------
* 
* @constant {string} targetdir - Absolute or relative root for file output.
* 
* Logic:
* Checks physical existence of the storage path. If absent, creates it 
* recursively. This ensures the logger never throws a fatal ENOENT error.
*----------------------------------------------------------------------------
*/
const targetdir = './logs'; 

if (!fs.existsSync(targetdir)) {
    fs.mkdirSync(targetdir, { recursive: true }); 
}

/** 
*--------------------------------------------------------------------------
* TRANSPORT BLUEPRINT ENGINE
*--------------------------------------------------------------------------
* 
* @function blueprint - Configuration factory for pino-roll file streams.
* @param {string} filelocation - Sub-directory/filename relative to targetdir.
* @param {string} rollfrequency - Time-based rotation trigger ('daily', 'hourly').
* @param {string} fileSize - Volume-based rotation trigger (e.g., '10m').
* @param {string} minLevel - Threshold filter for this specific file target.
* 
* Logic:
* Returns a standardized 'pino-roll' target object. Includes daily/size rotation
* and ensures resulting files follow the ISO date naming convention.
*----------------------------------------------------------------------------
*/
const blueprint = (filelocation, rollfrequency, fileSize, minLevel = 'info') => {
    return {
        target: 'pino-roll',
        level: minLevel, 
        options: {
            file: path.join(targetdir, filelocation),
            extension: '.json',
            frequency: rollfrequency,
            size: fileSize,
            mkdir: true,
            dateFormat: 'yyyy-MM-dd',
            sync: false // Non-blocking asynchronous I/O
        }
    };
};

/** 
*--------------------------------------------------------------------------
* TERMINAL OUTPUT CONFIGURATION
*--------------------------------------------------------------------------
* 
* @constant {Array} log_to_terminal - Conditional configuration for pino-pretty.
* 
* Logic:
* Enhances DX (Developer Experience) by colorizing JSON logs in the CLI.
* Automatically excluded in production to maximize throughput.
*----------------------------------------------------------------------------
*/
const log_to_terminal = isDevelopment ? [{
    target: 'pino-pretty',
    options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss'
    }
}] : [];

/** 
*--------------------------------------------------------------------------
* ISOLATED MULTI-STREAM TRANSPORTS (WORKER THREADS)
*--------------------------------------------------------------------------
* 
* Each transport initializes a separate worker thread for I/O.
* 
* 1. system_transport: Routes info/warnings to system and errors to error folder.
* 2. audit_transport: Strictly for legal/security state-change events.
* 3. access_transport: Specifically for high-volume HTTP traffic records.
*----------------------------------------------------------------------------
*/
const system_transport = pino.transport({ 
    targets: [
        blueprint('system/app-info', 'daily', '20m', 'info'), 
        blueprint('errors/app-error', 'daily', '20m', 'error'),
        ...log_to_terminal
    ] 
});

const audit_transport = pino.transport({ targets: [blueprint('audit/app-audit', 'daily', '20m'), ...log_to_terminal] });
const access_transport = pino.transport({ targets: [blueprint('access/app-access', 'daily', '20m'), ...log_to_terminal] });

/** 
*--------------------------------------------------------------------------
* MASTER CONFIGURATION GENERATOR
*--------------------------------------------------------------------------
* 
* @function getBaseConfig - Returns core engine settings for security.
* 
* Logic:
* - isoTime: Ensures standard T-format UTC timestamps.
* - mixin: Maps numeric levels (30) to human labels ('info') for readability.
* - redact: Scours JSON for PII keys and deletes them before disk entry.
*----------------------------------------------------------------------------
*/
const getBaseConfig = () => {
    return {
        level: logLevel,
        timestamp: pino.stdTimeFunctions.isoTime, 
        mixin(_context, levelNumber) {
            const labels = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' };
            return { levelLabel: labels[levelNumber] || 'info' };
        },
        redact: {
            paths: [
                'password', '*.password', 'token', '*.token', 
                'apiKey', 'ssn', 'req.headers.authorization', 'req.headers.cookie'
            ],
            remove: true
        }
    };
};

/** 
*--------------------------------------------------------------------------
* FINAL LOGGER INSTANCE EXPORTS
*--------------------------------------------------------------------------
* 
* Public API for application logging.
* @export {object} system_logger - Standard infrastructure/app events.
* @export {object} audit_logger - Compliance actions (Login, Delete, Update).
* @export {object} access_logger - HTTP middleware request/response logs.
*----------------------------------------------------------------------------
*/
export const system_logger = pino(getBaseConfig(), system_transport);
export const audit_logger = pino(getBaseConfig(), audit_transport);
export const access_logger = pino(getBaseConfig(), access_transport);

export default {
    system_logger,
    audit_logger,
    access_logger
};
