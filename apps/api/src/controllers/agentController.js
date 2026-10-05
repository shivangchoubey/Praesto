import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

import {
    generateAgentEnrollmentToken,
    generateAgentToken
} from "../services/authService.js";

import { createInstallationAccessToken } from "../services/githubService.js";

import authConfig from "../config/auth.js";
import { stat } from "node:fs";
import { error } from "node:console";

export const generateEnrollmentToken = async (req, res) => {
    try {
        const userId = req.user.userId;

        const token = generateAgentEnrollmentToken({
            id: userId
        });

        return res.json({
            message: "Agent enrollment token generated",
            token
        });
    } catch (error) {
        console.error(
            "Failed to generate agent enrollment token",
            error
        );

        return res.status(500).json({
            message: "Failed to generate agent enrollment token"
        });
    }
};

export const createAgent = async (req, res) => {
    try {
        const {
            enrollmentToken,
            machineName,
            operatingSystem,
            version
        } = req.body;

        if (!enrollmentToken) {
            return res.status(400).json({
                message: "Enrollment token is required"
            });
        }

        const decoded = jwt.verify(
            enrollmentToken,
            authConfig.jwtSecret
        );

        if (decoded.type !== "agent-enrollment") {
            return res.status(401).json({
                message: "Invalid agent enrollment token"
            });
        }

        const userId = decoded.userId;

       const existingAgent = await prisma.agent.findUnique({
    where: {
        userId
    }
});

if (existingAgent) {
    const agentToken = generateAgentToken(existingAgent);

    return res.status(200).json({
        message: "Existing agent authenticated successfully",
        agent: {
            id: existingAgent.id,
            machineName: existingAgent.machineName,
            operatingSystem: existingAgent.operatingSystem,
            version: existingAgent.version,
            status: existingAgent.status
        },
        token: agentToken
    });
}
        const agent = await prisma.agent.create({
            data: {
                userId,
                machineName,
                operatingSystem,
                version
            }
        });

        const agentToken = generateAgentToken(agent);

        return res.status(201).json({
            message: "Agent created successfully",
            agent: {
                id: agent.id,
                machineName: agent.machineName,
                operatingSystem: agent.operatingSystem,
                version: agent.version,
                status: agent.status
            },
            token: agentToken
        });
    } catch (error) {
        console.error("Failed to create agent", error);

        return res.status(401).json({
            message: "Invalid or expired agent enrollment token"
        });
    }
};

export const getAgent = async (req, res) => {
    try {
        const userId = req.user.userId;

        const agents = await prisma.agent.findMany({
            where: {
                userId
            }
        });

        return res.json({
            agents
        });
    } catch (error) {
        console.error("Failed to fetch agents", error);

        return res.status(500).json({
            message: "Failed to fetch agents"
        });
    }
};

export const updateHeartbeat = async (req, res) => {
    try {
        const agentId = req.agent.agentId;

        const agent = await prisma.agent.update({
            where: {
                id: agentId
            },
            data: {
                status: "ONLINE",
                lastHeartbeat: new Date()
            }
        });

        return res.json({
            message: "Agent status updated",
            agent: {
                id: agent.id,
                status: agent.status,
                lastHeartbeat: agent.lastHeartbeat
            }
        });
    } catch (error) {
        console.error(
            "Failed to update agent heartbeat",
            error
        );

        return res.status(500).json({
            message: "Failed to update agent heartbeat"
        });
    }
};

export const getNextDeployment = async (req,res)=>{
    try{
        const agentId=req.agent.agentId;
        const userId=req.agent.userId;

        const deployment= await prisma.deployment.findFirst({
            where:{
                agentId,
                status:"PENDING",
                project:{
                    userId
                }
            },
            orderBy:{
                createdAt:"asc"
            },
            include:{
                project:{
                    include:{
                        environmentVariables:true
                    }
                }
            }
        });
        if(!deployment){
           return  res.status(204).send();
        }

        const gitHubConnection=await prisma.gitHubConnection.findUnique({
            where:{
                userId
            }
        });
        if(!gitHubConnection){
            return res.status(409).json({
                message:"GitHub account is not connected"
            });
        }

        const installationToken=await createInstallationAccessToken(
            gitHubConnection.installationId
        );
        const updateDeployment= await prisma.deployment.update({
            where:{
                id:deployment.id
            },
            data:{
                status:"BUILDING",
                startedAt:new Date()
            }
        });

        return res.json({
            deployment:{
                id:updateDeployment.id,
                projectId:updateDeployment.projectId,
                commitHash:updateDeployment.commitHash,
                status:updateDeployment.status,
                startedAt:updateDeployment.startedAt
            },
            project:{
                id:deployment.project.id,
                repositoryUrl:deployment.project.repositoryUrl,
                repositoryName:deployment.project.repositoryName,
                defaultBranch:deployment.project.defaultBranch,
                framework:deployment.project.framework,
                environmentVariables:deployment.project.environmentVariables
            },
            github:{
                installationToken:installationToken.token
            }
        });
    } catch(error){
        console.error("Failed to fetch next deployment", error);

        return res.status(500).json({
            message:"Failed to fetch next deployment"
        });

    }
}

export const updateDeploymentStatus= async (req,res)=>{
    try{
        const {deploymentId}=req.params;
        const {status}= req.body;

        const allowedStatuses=[
            "BUILDING",
            "RUNNING",
            "FAILED",
            "OFFLINE"
        ];
        if(!allowedStatuses){
            return res.status(400).json({
                message:"Invalid deployment status"
            });
        }

        const deployment=await prisma.deployment.findFirst({
            where:{
                id:deploymentId,
                agentId:req.agent.agentId
            }
        });
        if(!deployment){
            return res.status(404).json({
                message:"Deployment not found"
            });
        }

        const now=new Date();
        const data={
            status
        };
        if(status==="BUILDING" && !deployment.startedAt){
            data.startedAt=now;
        }
        if(status==="FAILED"||status==="OFFLINE"){
            data.completedAt=now;
            if(deployment.startedAt){
                data.duration=Math.max(0,Math.floor(now.getTime()-deployment.startedAt.getTime())/1000);
            }

        }

        const updateDeployment=await prisma.deployment.update({
            where:{
                id:deployment.id
            },
            data
        });

        return res.json({
            message:"Deployment status updated",
            deployment:updateDeployment
        });
    }catch(error){
        console.error("Failed to update deployment status",error);
        return res.status(500).json({
            message:"Failed to update deployment status"
        });
    }
};

export const createDeploymentLog = async (req, res) => {
    try {
        const { deploymentId } = req.params;
        const { level, message } = req.body;
        const agentId = req.agent.agentId;

        if (!level) {
            return res.status(400).json({
                message: "Log level is required"
            });
        }

        if (!["INFO", "WARN", "ERROR"].includes(level)) {
            return res.status(400).json({
                message: "Invalid log level"
            });
        }

        if (!message || !message.trim()) {
            return res.status(400).json({
                message: "Log message is required"
            });
        }

        const deployment = await prisma.deployment.findFirst({
            where: {
                id: deploymentId,
                agentId
            }
        });

        if (!deployment) {
            return res.status(404).json({
                message: "Deployment not found"
            });
        }

        const deploymentLog = await prisma.deploymentLog.create({
            data: {
                deploymentId,
                level,
                message: message.trim()
            }
        });

        return res.status(201).json({
            message: "Deployment log created successfully",
            log: deploymentLog
        });

    } catch (error) {
        console.error("Failed to create deployment log", error);

        if (res.headersSent) {
            return;
        }

        return res.status(500).json({
            message: "Failed to create deployment log"
        });
    }
};