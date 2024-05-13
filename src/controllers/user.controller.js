import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User } from "../models/user.model.js"
import {uploadOnCloudinary} from '../utils/Cloudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


const genrateAccessAndRefreshToken=async(userId)=>{
  try {
    const user = await User.findById(userId);
    const accessToken = user.genrateAccessToken();
    const refreshToken = user.genrateRefreshToken();
    // console.log("Inside fnc",accessToken,refreshToken);
    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave:false});


    return { accessToken, refreshToken };

  } catch (error) {
     throw new ApiError(500,"Something went wrong while genrating access and refresh token");
  }
    

}


const registerUser = asyncHandler(async (req,res)=>{
   //get data from frontend

   const {username,fullName,email,password} = req.body;

   //console.log(password,email);
   
   if([username,email,fullName,password].some((field) => field?.trim() === "")){
    throw new ApiError(400,"All field is required");
   }

   const exitedUser = await User.findOne({
     $or: [{ username } , { email }]
   });

   if(exitedUser){
    throw new ApiError(409,"User with email and username is already exits");
   }

  //  console.log(req.files)
   const avatarLocalPath = req.files?.avatar[0]?.path;
   //const coverImageLocalPath = req.files?.coverImage[0]?.path;

   let coverImageLocalPath;
   if(registerUser.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
     coverImageLocalPath = req.files.coverImage[0].path;
   }


   if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is required");
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath);

  //  if(!coverImageLocalPath){
  //   throw new ApiError(400,"Cover Image file is required");
  //  }


   const coverImage = await uploadOnCloudinary(coverImageLocalPath);


   if(!avatar){
    throw new ApiError(400,"Avatar file is required");
   }

   const user = await User.create({
    fullName,
    avatar:avatar.url,
    coverImage:coverImage?.url || "",
    email,
    password,
    username:username.toLowerCase()
   });

  const createdUser = await User.findById(user._id).select(
    "-password  -refreshToken"
  );
  
  if(!createdUser){
    throw new ApiError(500,"Something went wrong while registering a user");
  }


  return res.status(201).json(
    new ApiResponse(200,createdUser,"User Registered Successfully")
  );

});


const loginUser = asyncHandler(async(req,res)=>{
   //data ---> res

   const {username,email,password} = req.body;

   if(!username && !email){
    throw new ApiError(400,"username or email is required");
   }

   const user = await User.findOne({
    $or: [{username},{email}]
   });

   if(!user){
    throw new ApiError(404,"User does not exits");
   }
   
  const isPasswordValid = await  user.isPasswordCorrect(password);

  if(!isPasswordValid){
    throw new ApiError(401,"Invalid user credintials");
  }
  
  const {accessToken,refreshToken}=await genrateAccessAndRefreshToken(user._id);

  // console.log(accessToken,refreshToken);
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options ={
    httpOnly:true,
    secured:true
  }
  
  return res
  .status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser,accessToken,refreshToken  
      },
      "User loggedIn Successfully",
    )
  );

});

const logoutUser =asyncHandler(async(req,res)=>{
  // req.user
  await User.findByIdAndUpdate(
    req.user._id,{
      $set: {
        refreshToken : undefined,
      }
    },
    {
      new:true
    }
  )

  const options ={
    httpOnly:true,
    secured:true
  }

  return res.status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200,{},"User Logout Successfully"));

})


const refreshAccessToken = asyncHandler(async(req,res)=>{
  const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken;

  if(!incomingRefreshToken){
    throw new ApiError(401,"Unauthorized Access");
  }

   try {
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
 
    const user = await User.findById(decodedToken?._id);
 
 
    if(!user){
     throw new ApiError(401,"Invalid refresh token");
    }
 
    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401,"Refresh token is expired or used");
    }
 
    const options ={
     httpOnly:true,
     secured:true
    }
 
    const {accessToken,refreshToken}=await genrateAccessAndRefreshToken(user._id);
 
 
    return res.status(200)
    .cookie("accessToken",accessToken,actions)
    .cookie("refreshToken",newRefreshToken,actions)
    .json(
     new ApiResponse(
       200,
       {accessToken,refreshToken:newRefreshToken},
       "Access Token Refreshed"
     ))
   } catch (error) {
     throw new ApiError(401 , error?.message || "Invalid refresh Token");
   }
})


const changeCurrentPassword = asyncHandler(async(req,res)=>{
   
  const {oldPassword,newPassword} = res.body;


  const user = await User.findById(req.user?._id);

   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if(!isPasswordCorrect){
    throw new ApiError(400,"Invalid Old Password");
  }


  user.password = newPassword;

  await user.save({validateBeforeSave:false});


  return res.status(200)
  .json(
    new ApiResponse(
      200,
      {},
      "Password Change Successfully"
    )
  )

});

const getCurrentUser = asyncHandler(async(req,res)=>{
  return res.status(200).
  json(
    new ApiResponse(
      200,
      req.user,
      "Current user fetch successfully"
    )
  )
});

const updateAccountDetails = asyncHandler(async(req,res)=>{
   const {fullName,email}= req.body;

   if(!fullName || !email){
    throw new ApiError(400,"All fields are Required");
   }

   const user= await User.findByIdAndUpdate(
    user?._id,
    {
      $set: {fullName , email:email }
    },
    {new:true}
  ).select("-password");
  
  return res.status(200)
  .json(
    new ApiResponse(
      200,
      {},
      "User Information Updated Successfully"
    )
  )

});

const updateUserAvatar= asyncHandler(async(req,res)=>{

  const avatarLocalPath = req.file?.path;
  
  if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is missing");
  }
  
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if(!avatar.url){
    throw new ApiError(400,"Error while uploading avatar on server");
  }


  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set : {
        avatar : avatar.url
      }
    },
    {new:true}
  ).select("-password");

  res.status(200)
  .json(
    new ApiResponse(
      200,
      user,
      "Avatar Updated Successfully"
    )
  );

});


const updateUserCoverImage = asyncHandler(async(req,res)=>{

    const coverImageLocalPath = req.file?.path;
     
    if(!coverImageLocalPath){
      throw new ApiError(400,"Cover Image file is missing");
    }
   
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
      throw new ApiError(400,"Error while uploading Cover Image on server");
    }


   const user = User.findByIdAndUpdate(
      req.user._id,
      {
         $set :{
          coverImage : coverImage.url,
         }
      },
      {
        new :true
      }
    ).select("-password");


    res.status(200)
    .json(
      new ApiResponse(
        200,
        user,
        "Cover Image Updated Successfully"
      )
    );

});


const getUserChannelProfile = asyncHandler(async(req,res)=>{
  const {username} = req.params;

  if(!username.trim()){
    throw new ApiError(400,"User is missing");
  }

  const channel= await User.aggregate([
    {
      $match:{
        username : username?.toLowerCase()
      }
    },
    {
        $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers",
      }
    },
    {
      $lookup:{
      from:"subscriptions",
      localField:"_id",
      foreignField:"subscriber",
      as:"subscribedTo",
    }
  },
  {
    $addFields : {
      subscriberCount: {
        $size: "$subscribers"
      },
      channelsSubcriberToCount:{
        $size : "$subscribedTo"
      },
      isSubscribed:{
        $cond: {
          if :{ $in : [req.user._id, "$subscribers.subscriber"]},
          then:true,
          else:false
    }
    } 
   }
  },
  {
    $project:{
      fullName:1,
      username:1,
      email:1,
      subscriberCount:1,
      channelsSubcriberToCount:1,
      isSubscribed:1,
      avatar:1,
      coverImage:1
    }
  }  
  ])

  if(!channel?.length){
    throw new ApiError(400,"Channel does not exits");
  }

  return res.status(200)
  .json(
    new ApiResponse(
      200,
      channel[0],
      "User Channel fetched successfully"
    )
  )
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile
}
