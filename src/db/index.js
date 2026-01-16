import mongoose from "mongoose";
import { APP_NAME } from "../constants.js";


const connectToDatabase = async () => {
    try{
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI,{
            dbName: APP_NAME
        });
        console.log("\n Connected to MongoDB", `${connectionInstance.connection.host}`);
    }catch{
        console.error("Failed to connect to MongoDB");  
        process.exit(1);
    }
};

export default connectToDatabase;