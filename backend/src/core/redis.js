
/** 
|--------------------------------------------------------------------------------------
|
|                               REDIS CONNECTION LAYER
|
|--------------------------------------------------------------------------------------
| @param {string} config.redis_uri - The connection string/URL for the Redis instance.
|  Redis is used for:
|  - Rate-limiting login attempts 
|  - Session and token tracking
|  - Temporary state storage
|
|  Security Rationale:
|  - Brute-force mitigation requires fast in-memory counters.
|  - Redis failures must be logged and monitored.
|  - System should fail gracefully if Redis is critical for auth flows.
|-------------------------------------------------------------------------------------
*/

import Redis from 'ioredis';
import config from '../config/config.js';
import { system_logger } from './logger.js';


// Initialize Redis client using URL from config
const redis = new Redis(config.redis_uri);


/*
|-------------------------------------------
|  CONNECTION SUCCESS HANDLER
|-------------------------------------------
|
|  Logging the connection is important for:
|  - Audit traceability 
|
|-------------------------------------------
*/


redis.on('connect', ()=>{
    system_logger.info("Redis connected successfully");
})



/*
|------------------------------------------------------
|  CONNECTION ERROR HANDLER
|------------------------------------------------------
| 
|  - Capture infrastructure errors immediately
|  - Do not fail silently
|  - Include full stack in secure logs 
|------------------------------------------------------
*/

redis.on("error", (err)=>{
    system_logger.error({error: err.message},"Could not connect Redis");
})


export default redis;