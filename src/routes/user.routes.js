import {Router} from 'express';
import {
    registerUser,
    loginUser,
    LogoutUser,
    refreshAccessToken,
    ChangeCurrentUserPassword,
    getCurrentUser,
    UpdateAccontDetails,
    UpdateUserAvatar,
    UpdateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
        } from '../controllers/user.controller.js';
import {upload} from '../middlewares/multer.middleware.js';
import {verifyJWT} from '../middlewares/auth.middleware.js';

const router = Router();

router.route("/register").post(
    upload.fields([
        {
        name : "avatar",
        maxCount: 1
        },
        {
            name : "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
);

router.route("/login").post(
    loginUser
);


router.route("/logout").post(
    verifyJWT,
    LogoutUser
);

router.route("/refresh-token").post(verifyJWT,refreshAccessToken);

router.route("/change-password").post(verifyJWT, ChangeCurrentUserPassword);

router.route("-current-user").post(verifyJWT, getCurrentUser);

router.route("update-account-detail").post(verifyJWT, UpdateAccontDetails);

router.route("/avatar").post(verifyJWT, upload.single("avatar"), UpdateUserAvatar);

router.route("update-coverImage").post(verifyJWT, upload.single("coverImage"), UpdateUserCoverImage);

router.route("/c/:username").get(verifyJWT, getUserChannelProfile);

router.route("/watch-History").get(verifyJWT, getWatchHistory);

export default router;