import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User } from "../models/user.model.js"
import {uploadOnCloudinary} from '../utils/Cloudinary.js'
import { application } from "express";
import { ApiResponse } from "../utils/ApiResponse.js";


const registerUser = asyncHandler(async (req,res)=>{
   //get data from frontend

   const {fullName,email,password} = req.body;

   //console.log(password,email);
   
   if(
    [username,email,fullName,password].some((field)=> field.trim() === "")
   ){
    throw new ApiError(400 ,"All field is rquired");
   }

   const exitedUser = User.findOne({
     $or: [{ username } , { email }]
   });

   if(exitedUser){
    throw new ApiError(409,"User with email and username is already exits");
   }


   const avatarLocalPath = req.files?.avatar[0]?.path;
   const coverImageLocalPath = req.files?.coverImage[0]?.path;


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


export {
  registerUser
}
