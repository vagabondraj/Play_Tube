import asyncHandler from "express-async-handler";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.models.js"
import Video from "../models/video.models.js";
import Comment from "../models/comment.models.js"
import Like from "../models/like.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import deleteFromCloudinary from "../utils/deleteFromCloudinary.js";
import mongoose from "mongoose";

// get all videos based on query, sort, pagination
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    console.log(userId);
    const pipeline = [];

    // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'search-videos'
    if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query: query,
                    path: ["title", "description"] //search only on title, desc
                }
            }
        });
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId");
        }

        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    // fetch videos only that are set isPublished as true
    pipeline.push({ $match: { isPublished: true } });

    //sortBy can be views, createdAt, duration
    //sortType can be ascending(-1) or descending(1)
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    )

    const videoAggregate = Video.aggregate(pipeline);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const video = await Video.aggregatePaginate(videoAggregate, options);

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Videos fetched successfully"));
});

// upload viedo to cloudinary
const publishVideo = asyncHandler(async (req, res) => {
    const {title, description} = req.body;

    if([title, description].some((field) => field?.trim() == "")){
        throw new ApiError(400, "All fields are required");
    }

    const videoFileLocalPath = req.files?.videoFile[0].path;
    const thumbnailLocalPath = req.files?.thumbnail[0].path;
    if (!videoFileLocalPath) {
        throw new ApiError(400, "videoFileLocalPath is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnailLocalPath is required");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        throw new ApiError(400, "Video file not found");
    }

    if (!thumbnail) {
        throw new ApiError(400, "Thumbnail not found");
    }

    const video = await Video.create({
        title,
        description,
        duration: videoFile.duration,
        videoFile: {
            url : videoFile.url,
            public_id : thumbnail.public_id
        },
        thumbnail: {
            url : thumbnail.url,
            public_id: thumbnail.public_id
        },
        owner: req.user?._id,
        isPublished : false
    });
    const videoUploaded = await Video.findById(video._id);
    if (!videoUploaded) {
        throw new ApiError(500, "videoUpload failed please try again !!!");
    }

    return res
    .status(200)
    .json(new ApiResponse(500, "Video uploaded successfully"));
})


// findvideo
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    if (!isValidObjectId(req.user?._id)) {
        throw new ApiError(400, "Invalid userId");
    }

    const userId = new mongoose.Types.ObjectId(req.user._id);

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: { $size: "$subscribers" },
                            isSubscribed: {
                                $in: [userId, "$subscribers.subscriber"]
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: { $first: "$owner" },
                likesCount: { $size: "$likes" },
                isLiked: {
                    $in: [userId, "$likes.likedBy"]
                }
            }
        },
        {
            $project: {
                "videoFile.url": 1,
                title: 1,
                description: 1,
                views: 1,
                createdAt: 1,
                duration: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1
            }
        }
    ]);

    if (!video.length) {
        throw new ApiError(404, "Video not found");
    }

    // increment views
    await Video.findByIdAndUpdate(videoId, {
        $inc: { views: 1 }
    });

    // add to watch history
    await User.findByIdAndUpdate(userId, {
        $addToSet: { watchHistory: videoId }
    });

    return res.status(200).json(
        new ApiResponse(200, video[0], "Video details fetched successfully")
    );
});

// update video details like title, description, thumbnail
const updateVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    if (!title && !description && !req.file) {
        throw new ApiError(400, "Nothing to update");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "No video found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            403,
            "You can't edit this video as you are not the owner"
        );
    }

    //  prepare update object 
    const updateFields = {
        ...(title && { title }),
        ...(description && { description })
    };

    //  thumbnail update is OPTIONAL
    if (req.file?.path) {
        const uploadedThumbnail = await uploadOnCloudinary(req.file.path);

        if (!uploadedThumbnail) {
            throw new ApiError(400, "Failed to upload thumbnail");
        }

        // use deleteFromCloudinary (your existing util)
        if (video.thumbnail?.public_id) {
            await deleteFromCloudinary(video.thumbnail.public_id);
        }

        updateFields.thumbnail = {
            public_id: uploadedThumbnail.public_id,
            url: uploadedThumbnail.url
        };
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: updateFields 
        },
        { new: true }
    );

    if (!updatedVideo) {
        throw new ApiError(500, "Failed to update video please try again");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedVideo, "Video updated successfully")
        );
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "No video found");
    }

    //  use proper forbidden status code
    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            403, 
            "You can't delete this video as you are not the owner"
        );
    }

    // 🆕 ADDED: delete files from Cloudinary BEFORE deleting DB record
    if (video.thumbnail?.public_id) {
        await deleteFromCloudinary(video.thumbnail.public_id); // 🔁 CHANGED
    }

    if (video.videoFile?.public_id) {
        await deleteFromCloudinary(
            video.videoFile.public_id,
            "video" // explicitly specify resource type
        );
    }

    //  delete video document AFTER cloud cleanup
    const videoDeleted = await Video.findByIdAndDelete(videoId);

    if (!videoDeleted) {
        throw new ApiError(500, "Failed to delete the video please try again");
    }

    //  delete video likes
    await Like.deleteMany({
        video: videoId
    });

    //  delete video comments
    await Comment.deleteMany({
        video: videoId
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Video deleted successfully")
        );
});

// toggle publish status of a video
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    //  use proper forbidden status code
    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            403, 
            "You can't toggle publish status as you are not the owner" 
        );
    }

    //  toggle publish status safely
    const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished 
            }
        },
        { new: true }
    );

    if (!toggledVideoPublish) {
        throw new ApiError(500, "Failed to toggle video publish status"); 
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isPublished: toggledVideoPublish.isPublished },
                "Video publish status toggled successfully" 
            )
        );
});

export {
    publishVideo,
    updateVideo,
    deleteVideo,
    getAllVideos,
    getVideoById,
    togglePublishStatus
};



