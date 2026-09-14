import prisma from "../lib/prisma";

import{
    createInstallationAccessToken,
    getLatestCommitSha
} from "../services/githubService.js";

export const createDeployment = async(req,res) =>{
    try{
        const {id: projectId} = req.params;
        const userId = req.user.userId;
        const project = await prisma.project.findFirst({
            where:{
                id:projectId,
                userId
            }
        });
        if(!project){
            return res.status(404).json({
                message:"Project not found"
            })
        }

        const agent = await prisma.agent.findUnique({
            where:{
                userId
            }
        });
        if(!agent){
            return res.status(404).json({
                message:"No agent is found for this user"
            });
        }

        if(agent.status !=="ONLINE"){
            return res.status(409).json({
                message:"Agent is offline"
            });
        }

        if(!project.installationId || !project.githubRepositoryId){
            return res.status(400).json({
                message:"Project is not connected to GitHub"
            });
        }

        const gitHubConnection= await prisma.gitHubConnection.findUnique({
            where:{
                userId
            }
        });
        if(!gitHubConnection){
            return res.status(404).json({
                message:"GitHub account is not connected"
            });
        }
        const installationToken= await createInstallationAccessToken(
            gitHubConnection.installationId
        );

        const repositoryPath = new URL(project.repositoryUrl).pathname.replace(/^\/+/, "")
                .replace(/\/+$/, "")
                .replace(/\.git$/, "");

        
        const commitHash= await getLatestCommitSha(
            installationToken.token,
            repositoryPath,
            project.defaultBranch
        );

        const deployment = await prisma.deployment.create({
            data:{
                projectId,
                agentId:agent.id,
                commitHash,
                status:"PENDING"
            }
        });

        return res.status(201).json({
            message:"Deployment created successfully",
            deployment
        });

    }catch(error){
        console.error(
            "failed to create deployment",
            error
        );
        return res.status(500).json({
            message:"Failed to create deployment"
        });
    }
};