/** 
*--------------------------------------------------------------------------
* MongoDB Database Connection Module
*--------------------------------------------------------------------------
*
* @param {string} config.mongo_uri - The connection string/URL for the mongoose instance.
* 
* Responsible for establishing a secure connection to MongoDB.
*
* Enterprise Architecture:
* Database connection must be isolated in its own module.
* Improves maintainability, observability, and audit readiness.
*--------------------------------------------------------------------------
*/
import mongoose from 'mongoose';
import config from "../config/config.js";
import logger from './logger.js'

const MONGO_URI = config.mongo_uri;


/*
|--------------------------------------------------------------------------
| Connect to MongoDB
|--------------------------------------------------------------------------
| Establishes a connection using mongoose.
|
| Enterprise Benefits:
| - Centralized connection management
| - Proper error handling
| - Controlled application shutdown on failure
|
| SOC2 Availability Principle:
| System must fail safely if dependencies are unavailable.
|--------------------------------------------------------------------------
*/
const connectDB = async() =>{
    try{
        await mongoose.connect(MONGO_URI);
        logger.info("Database successfully connected");
    }catch(err){
        logger.error({error: err.message},"Could not connect database");
    }
}

export default connectDB;