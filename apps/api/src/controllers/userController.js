import { use } from "react";
import prisma from "../lib/prisma";
export const createUser = async (req,res)=>{
    try{
        const { githubId, username, email, avatarUrl } =req.body;
        const user= await prisma.user.create({
            data:{
                githubId,
                username,
                email,
                avatarUrl
            }
        });
        
        res.status(201).json({
            message:"User created successfully",
            user
        });
    }catch(error){
        console.log("Failed to create user",error);

        res.status(500).json({
            message:"Failed to create user"
        });
    }
};

export const getUser= async (req,res)=>{
    try{
        const users=await prisma.user.findMany();

        res.json({
            users
        });

    }catch(error){
        console.log("Failed to fetch user",error);

        res.status(500).json({
            message:"Failed to fetch users"
        });
    }
};

export const getUserById = async (req,res)=>{
    try{
        const {id} = req.params;
        const user=await prisma.user.findUnique({
            where:{
                id
            }
        });

        if(!user){
            return res.status(404).json({
                message:'User not found'
            });
        }
        res.json({
            user
        });
    }catch(error){
        console.log("Failed to fetch user by id",error);

        res.status(500).json({
            message:"Failed to fetch user"
        });
    }
}