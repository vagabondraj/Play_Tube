const asyncHandler = (requestHandler) => async (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next))
    .catch(err => {
        res.status(err.code || 500).json({
            success: false,
            message: err.message || "Internal Server Error"
        });
    }); 
}

export {asyncHandler}

// const asyncHandler = (fn) => async (req, res, next) => {
//     try{
//         await function(req, res, next);
//     }catch(err){
//         res.status(err.code || 500).json({
//             success: false,
//             message: err.message || "Internal Server Error"
//         });
//     }
// }