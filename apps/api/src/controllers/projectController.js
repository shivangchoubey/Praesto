import prisma from '../lib/prisma.js';
import { createInstallationAccessToken, getInstallationRepositoriesById } from '../services/githubService.js';

export const createProject = async (req,res) => {
    try{
        const{
            githubRepositoryId,
            framework,
            visiblity
        } = req.body;
        if(!githubRepositoryId){
            return res.status(400).json({
                message:"Github repository is required"
            });
        }

        const userId=req.user.userId;

        const githubConnection=await prisma.gitHubConnection.findUnique({
            where:{
                userId
            }
        });
        if(!githubConnection){
            return res.status(404).json({
                message:"Github account is not connected"
            });
        }

        const installationToken=await createInstallationAccessToken(
            githubConnection.installationId
        );

        const repository = await getInstallationRepositoriesById(
            installationToken.token,
            githubRepositoryId
        );
        if(!repository){
            return res.status(403).json({
                message:"Repository is not accessible"
            });
        }

        const project = await prisma.project.create({
            data:{
                userId,
                repositoryName:repository.name,
                repositoryUrl:repository.html_url,
                defaultBranch:repository.default_branch,
                framework,
                visiblity,
                installationId:githubConnection.installationId,
                githubRepositoryId:String(repository.id)
            }
        });

        return res.status(201).json({
            message:"Project created successfully",
            project
        });
    }catch(error){
        console.error("Failed to create project",error);

        return res.status(500).json({
            message:"Failed to create Project"
        });
    }
};

export const getProjects = async (req,res) =>{
    try{
        const userId=req.user.userId;
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
        const userId=req.user.userId;
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
        const {framework,visiblity}=req.body;
        const userId=req.user.userId;

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
        const userId=req.user.userId;
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
