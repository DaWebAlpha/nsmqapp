/** 
*--------------------------------------------------------------------------
* MODULE: DATABASE INFRASTRUCTURE
*--------------------------------------------------------------------------
* 
* @module src/core/database
* @description Centralized MongoDB connection engine using Mongoose ODM.
* @compliance SOC2 (Availability), NIST (Infrastructure Security)
* 
* RESPONSIBILITIES:
* 1. Establish a secure, singleton connection to the MongoDB cluster.
* 2. Provide real-time observability of connection states via system_logger.
* 3. Ensure the application fails safely if the data layer is unreachable.
*--------------------------------------------------------------------------
*/

import mongoose from 'mongoose';
import config from "../config/config.js";
import { system_logger } from './logger.js';

/**
 * @constant {string} MONGO_URI - The authenticated connection string.
 * Derived from encrypted environment variables for security.
 */
const MONGO_URI = config.mongo_uri;

/** 
*--------------------------------------------------------------------------
* DATABASE CONNECTION BOOTSTRAP
*--------------------------------------------------------------------------
* 
* @function connectDB
* @async
* @description Initializes the asynchronous handshake with MongoDB.
* 
* Logic:
* 1. Attempts connection using the provided MONGO_URI.
* 2. On Success: Dispatches an 'info' event to the system_logger.
* 3. On Failure: Dispatches an 'error' event with the specific error message
*    to both the system and error log files for immediate alerting.
*----------------------------------------------------------------------------
*/


const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            /**
             * serverSelectionTimeoutMS
             * --------------------------------------------------------------
             * Limits how long Mongoose will wait when selecting a MongoDB
             * server before throwing an error.
             *
             * Default can be ~30 seconds, which is too long for production.
             * We reduce to 5 seconds for faster failure detection.
             */
            serverSelectionTimeoutMS: 5000,

            /**
             * maxPoolSize
             * --------------------------------------------------------------
             * Maximum number of concurrent connections allowed in the pool.
             *
             * Controls load pressure on the database.
             * Prevents connection exhaustion.
             */
            maxPoolSize: 50,

            /**
             * minPoolSize
             * --------------------------------------------------------------
             * Minimum number of open connections kept warm.
             *
             * Reduces cold-start latency for first incoming users.
             */
            minPoolSize: 5,

            /**
             * retryWrites
             * --------------------------------------------------------------
             * Enables automatic retry of certain transient write failures.
             *
             * Recommended for replica sets and production clusters.
             */
            retryWrites: true
        });

        system_logger.info("Database successfully connected - Production pool initialized");

    } catch (err) {

        system_logger.error(
            { error: err.message },
            "Database Connection Failure - Service Unavailable"
        );

        /**
         * Fail Fast Strategy
         * --------------------------------------------------------------
         * We immediately re-throw the error to prevent the application
         * from running without a functional data layer.
         */
        throw err;
    }
};

export default connectDB;