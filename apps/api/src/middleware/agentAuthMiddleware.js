import jwt from "jsonwebtoken";
import authConfig from "../config/auth";
export const authenticateAgent =(req,res,next)=>{
    try{
        const authorization=req.headers.authorization;

        if(!authorization){
            return res.status(401).json({
                message:"Agent authentication required"
            });
        }
        const[scheme, token]=authorization.split(" ");

        if(scheme !== "Bearer" || !token){
            return res.status(401).json({
                message:"Invalid authorization header"
            });
        }
        const decoded = jwt.verify(
            token,
            authConfig.jwtSecret
        );
        if(decoded.type !== "agent"){
            return res.status(403).json({
                message:"Agent authentication required"
            });
        }

        req.agent=decoded;
        next();
    }catch(error){
        console.error("Agent authentication failed",error);

        return res.status(401).json({
            message:"Invalid or expired agent token"
        });
    }
};