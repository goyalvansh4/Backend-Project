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

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken
}
