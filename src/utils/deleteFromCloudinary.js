import {v2 as cloudinary} from "cloudinary";

const deleteFromCloudinary = async(imageUrl) => {
    try{
        if(!imageUrl) return;

        const publicId = imageUrl
        .split("/")
        .slice(imageUrl.split("/").indexOf("upload") + 2)
        .join("/")
        .split(".")[0];

        const result = await cloudinary.uploader.destroy(publicId);
        console.log("Cloudinary delete:", result);
    }catch(error){
        console.log("Cloudinary upload error:",error.message);
    }
}

export default deleteFromCloudinary;