import jwt from 'jsonwebtoken';
import authConfig from '../config/auth';

export const generatePraestoToken=(user)=>{
    return jwt.sign(
        {
            userId:user.id,
            githubId:user.githubId
        },
        authConfig.jwtSecret,
        {
            expiresIn:authConfig.jwtExpiresIn
        }
    );
};