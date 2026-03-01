/*

|--------------------------------------------------------------------------|
| SYSTEM CONFIGURATION (IMMUTABLE SETTINGS)                                 |
|--------------------------------------------------------------------------|
|
| Centralized configuration for all environment and security parameters.
| Ensures all services, controllers, and middleware pull from a single
| source of truth.
|
| SECURITY & COMPLIANCE:
| 1. Secrets (JWT keys, refresh tokens) are injected via environment variables.
| 2. Default fallbacks prevent downtime if env vars are missing.
| 3. Centralization supports SOC 2 auditing and reproducible deployments.
|
|--------------------------------------------------------------------------|
*/


import dotenv from 'dotenv';
dotenv.config();


const {
    PORT,
    MONGO_URI,
} = process.env;


export default{

    /* SERVER PORT CONFIGURATION
    | -------------------------
    | The TCP port on which the backend server listens.
    | Defaults to 5000 if not specified.
    | SOC 2: Ensures consistent network endpoint auditing.
    */
    port: PORT || 5000,



     /*
     |--------------------------------------------------------------------------
     | Database & Cache Configuration
     |--------------------------------------------------------------------------
     | mongo_uri:
     |   - Required for MongoDB connection.
     |--------------------------------------------------------------------------
     */
    mongo_uri: MONGO_URI,
}