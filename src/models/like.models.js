import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const likeSchema = new Schema({
    video: {
        type: Schema.Types.ObjectId,
        ref: "Video"
    },
    Comment: {
        type: Schema.Types.ObjectId,
        ref:"Comment"
    },
    tweet: {
        type: Schema.Types.ObjectId,
        ref: "Tweet"
    },
    likedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }

},
{timestamps : true});

videoSchema.plugin(mongooseAggregatePaginate);
export const Like = mongoose.model("Like", likeSchema);