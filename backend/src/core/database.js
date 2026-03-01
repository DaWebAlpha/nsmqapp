import mongoose from 'mongoose';
import config from "../config/config.js";


const MONGO_URI = config.mongo_uri;


const connectDB = async() =>{
    try{
        await mongoose.connect(MONGO_URI);
        logger.info("Database successfully connected");
    }catch(err){
        logger.error(err,"Could not connect database");
    }
}

export default connectDB();