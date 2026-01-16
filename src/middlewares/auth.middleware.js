import {ApiError} from "../utils/ApiError.js";
import {asynchandler} from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import User from "../models/user.models.js";


export const verifyJWT = asynchandler(async (req, res, next) => {
    try {
        const authHeader = req.headers("Authorization")?.replace("Bearer ", "");
        const token = req.cookies?.accessToken || authHeader;
        
        if(!token){
            return res.status(401).json({message : "Unauthorized: No token provided"});
        }   
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    
        if(!user){
            return res.status(401).json({message : "Unauthorized: Invalid token"});
        }
    
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Unauthorized: Invalid token");
    }
});