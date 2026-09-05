import jwt from 'jsonwebtoken';
import authConfig from '../config/auth';
import { type } from 'os';

export const generatePraestoToken=(user)=>{
    return jwt.sign(
        {
            userId:user.id,
            githubId:user.githubId,
            type:"user"
        },
        authConfig.jwtSecret,
        {
            expiresIn:authConfig.jwtExpiresIn
        }
    );
};
export const generateAgentEnrollmentToken =(user)=>{
    return jwt.sign(
        {
            userId:user.id,
            type:"agent-enrollment"

        },
        authConfig.jwtSecret,{
            expiresIn:"10m"
        }

    );
};

export const generateAgentToken = (agent)=>{
    return jwt.sign(
        {
        agentId:agent.id,
        userId:agent.userId,
        type:"agent"
        },
        authConfig.jwtSecret,
        {
            expiresIn:"30d"
        }
    );
};

