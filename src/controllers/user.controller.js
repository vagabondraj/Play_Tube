import asyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


const registerUser = asyncHandler(async (req, res) => {
    const{username, email, password, fullName} = req.body;
    console.log("username", username);
    
    if(!username || !email || !password || !fullName){
        throw new ApiError(400, "All fields are required");
    }
    // to validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
        throw new ApiError(400, "Invalid email format");
    }

    const existingUser = await User.findOne({
        $or: [{email}, {username}]
    });
    if(existingUser){
        throw new ApiError(409, "User with this email already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar and Cover Image are required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Failed to upload avatar");
    }

    
});

export {registerUser};
