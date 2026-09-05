import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

import {
    generateAgentEnrollmentToken,
    generateAgentToken
} from "../services/authService.js";

import authConfig from "../config/auth.js";

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