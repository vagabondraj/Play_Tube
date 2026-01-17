import asyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import deleteFromCloudinary from "../utils/deleteFromCloudinary.js";


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
    const{username, email, password, fullName} = req.body;
    
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
        fullName,
        email: email.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

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

    if(!user){
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
        secure: process.env.NODE_ENV=== 'production',
        secure: true,
    };

    return res.status(200).cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options).json(
        new ApiResponse(200, {loggedInUser, accessToken, refreshToken}, "User logged in successfully")
    );
});

const LogoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
         {
            $set: {
                refreshToken: null,
            }
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
    
        const {accessToken, refreshToken: newrefreshToken} = await generateAccessAndRefreshToken(user._id);
    
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

const ChangeCurrentUserPassword = asyncHandler(async (req, res) => {
    // Implementation for changing current user's password
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const user = await User.findById(req.user?._id);
    if(!user){
        throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.isPasswordMatch(currentPassword);

    if(!isPasswordValid){
        throw new ApiError(401, "Current password is incorrect");
    }

    if(newPassword !== confirmPassword){
        throw new ApiError(400, "New password and confirm password do not match");
    }
    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) =>{
    return res
    .status(200)
    .json(new ApiResponse(200, "Current user fetched successfully"));
});

const UpdateAccontDetails = asyncHandler(async (req,res) =>{
    const {fullName, email} = req.body;

    if(!fullName||!email){
        throw new ApiError(401, "Full name and email are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email : email
            }
        },
        {new: true},

    ).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Account details updated."));
});

const UpdateUserAvatar = asyncHandler(async (req, res) => {
      const avatarLocalPath = req.file?.path; 

      if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is missing");
      }

      const oldAvatar = await User.findById(req.user?._id.select("avatar"));

      const avatar = await uploadOnCloudinary(avatarLocalPath);

      if(!avatar?.url){
        throw new ApiError(401, "Error while uploading avatar");
      }

      const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
      ).select("-password")

      if(oldAvatar?.avatar){
        await deleteFromCloudinary(oldAvatar.avatar);
      }

      return res
      .status(200)
      .json(
        new ApiResponse(200, user, "Avatar updated sucessfully")
      )
});

const UpdateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400, "CoverImage not found");
    }

    const oldCoverImage = await User.findById(req.user?._id).select("coverImage");

    const coverImage = await uploadOnCloudinary(avatarLocalPath);

    if(!coverImage?.url){
        throw new ApiError(401, "Error while uploding cover Image");
    }
    
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new : true}
    ).select("-password")

    if(oldCoverImage?.coverImage){
        await deleteFromCloudinary(oldCoverImage.coverImage);
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover Image Uploaded Succesfully")
    )
})


export {registerUser,
    loginUser,
    LogoutUser,
    refreshAccessToken,
    ChangeCurrentUserPassword,
    getCurrentUser,
    UpdateAccontDetails,
    UpdateUserAvatar,
    UpdateUserCoverImage
};

