import prisma from '../lib/prisma.js';

export const createProject = async (req,res) => {
    try{
        const{
            userId,
            repositoryName,
            repositoryUrl,
            defaultBranch,
            framework,
            visiblity
        } = req.body;
        const project = await prisma.project.create(
            {
                data:{
                    userId,
                    repositoryName,
                    repositoryUrl,
                    defaultBranch,
                    framework,
                    visiblity
                }
            });
            res.status(201).json({
                message:"Project created successfully",
                project
            });

    }catch(error){
        console.error("Failed to create project",error);
        
        res.status(500).json({
            message:"Failed to create Project"
        });
    }
};

export const getProjects = async (req,res) =>{
    try{
        const {userId}=req.query;
        const projects = await prisma.project.findMany(
            {
                where:{
                    userId
                }
            });
            res.json({
                projects
            })
    }catch(error){
        console.error("Failed to fetch projects",error);

        res.status(500).json({
            message:"Failed to fetch Projects"
        });
    }
};

export const getProject = async (req,res) =>{
    try{
        const {id}= req.params;
        const {userId}=req.query;
        const project= await prisma.project.findFirst({
            where:{
                id,
                userId
            }
        });
        if(!project){
            return res.status(404).json({
                message:"Project not found"
            });
        }
        res.json({
            project
        });
    }catch(error){
        console.error("Failed to fetch project", error);
        
        res.status(500).json({
            message:"Failed to fetch project"
        });
    }
};

export const updateProject = async (req,res) =>{
    try{
        const {id}=req.params;
        const {userId,repositoryName,repositoryUrl,defaultBranch,framework,visiblity}=req.body;

        const existingProject= await prisma.project.findFirst({
           where:{
            id,
            userId
           }
            
           
        });
        if(!existingProject){
            return res.status(404).json({
                message:"Project not found"
            });
        }

        const project = await prisma.project.update({
            where:{
                id
            },
            data:{
                repositoryName,
                repositoryUrl,
                defaultBranch,
                framework,
                visiblity
            }
        });
        res.json({
            message:"Project updated successfully",
            project
        });
    }catch(error){
        console.error("Failed to update project",error);
        res.status(500).json({
            message:"Failed to update Project"
        });
    }
};

export const deleteProject = async (req,res)=> {
    try{
        const {id}= req.params;
        const {userId}=req.query;
        const existingProject= await prisma.project.findFirst({
            where:{
                id,
                userId
            }
        });
        if(!existingProject){
            return res.status(404).json({
                message:"Project not found"
            });
        }
        await prisma.project.delete({
            where:{
                id
            }
        });

        res.json({
            message:"Project deleted successfully"
        });
    }catch(error){
        console.error("Failed to delete project",error);
        res.status(500).json({
            message:"Failed to delete project"
        });
    }
};
