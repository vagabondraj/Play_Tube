import {v2 as cloudinary} from "cloudinary";

const deleteFromCloudinary = async(imageUrl) => {
    try{
        if(!imageUrl) return;

        const publicId = imageUrl
        .split("/")
        .slice(-2)
        .join("/")
        .split(".")[0];

        await cloudinary.uploader.destroy(publicId);
    }catch(error){
        console.log("Cloudinary upload error:",error.message);
    }
}

export default deleteFromCloudinary;