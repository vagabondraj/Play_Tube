
import dotenv from "dotenv";
import app from "./app.js";
import { mongo } from "mongoose";
import { APP_NAME } from "./constants.js";
import connectToDatabase from "./db/index.js";

 
dotenv.config({ path: "./.env" });
connectToDatabase()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`${APP_NAME} server is running on port ${process.env.PORT}`);
    });
    app.on("error", (err) => {
        console.error("MongoDB connection error:", err);
    });
})
.catch((err) => {
    console.error("Failed to connect to MongoDB !!!", err);
});











/* Initialize Express Application and Connect to MongoDB */
// import express from "express";
// const app = express();
// (async () => {
//     try{
//         await mongo.connect(`${process.env.MONGO_DB_URI}/${APP_NAME}`);
//         app.on("errror", (err) => {
//             console.error("MongoDB connection error:", err);
//         });
//         console.log("Connected to MongoDB");

//         app.listen(process.env.PORT, () => {
//             console.log(`${APP_NAME} server is running on port ${process.env.PORT}`);
//         });
//     }catch(err){
//         console.error("Failed to connect to MongoDB", err);
//     }
// })();
