import asyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse..js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async(userId) => {
    try{
        const user = await User.findById(userId);

        if(!user){
            throw new ApiError(404, "User not found");
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken};
    }catch(error){
        console.error("REAL TOKEN ERROR 👉", error);
        throw new ApiError(500, "Failed to generate tokens");
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const{username, email, password, fullname} = req.body;
    
    if(!username || !email || !password || !fullname){
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
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath = "";
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar and Cover Image are required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Failed to upload avatar");
    }

    const user = await User.create({
        fullname,
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select("-password -refreshTokens");

    if(!createdUser){
        throw new ApiError(500, "Failed to create user");
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    );

});

const loginUser = asyncHandler(async (req, res) => {
    const {email, password, username} = req.body;

    if((!email && !username) || !password){
        throw new ApiError(400, "Email or Username and Password are required");
    }

    const user = await User.findOne({
        $or: [{email}, {username: username?.toLowerCase()}]
    });

    if(!user && !username && !email){
        throw new ApiError(401, "You are not registered user");
    }

    const isPasswordValid = await user.isPasswordMatch(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid credentials");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshTokens");

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res.status(200).cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options).json(
        new ApiResponse(200, {loggedInUser, accessToken, refreshToken}, "User logged in successfully")
    );
});

const LogoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,
         {
            $set: {
                refreshToken: null,
            },
        },
            {
                new: true,
            }
         );
        const options = {
            httpOnly: true,
            secure: true,
        };

        return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, null, "User logged out successfully")
        );

    
});


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Refresh token is missing unothorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?.id);
    
        if(!user){
            throw new ApiError(404, "User not found");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Invalid refresh token or user logged out");
        }
    
        const {accessToken, newrefreshToken} = await generateAccessAndRefreshToken(user._id);
    
        const options = {
            httpOnly: true,
            secure: true,
        };
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
            new ApiResponse(200, {accessToken, refreshToken: newrefreshToken}, "Access token refreshed successfully")
        );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid or expired refresh token");
    }
});

export {registerUser, loginUser, LogoutUser, refreshAccessToken};

