import jwt from "jsonwebtoken";
import authConfig  from "../config/auth";

export const authenticate =(req,res,next)=>{
    try{
        const authorization=req.headers.authorization;
        if(!authorization){
            return res.status(401).json({
                messsage:"Authentication required"
            });
        }
        const [scheme , token]= authorization.split(" ");

        if(scheme !== "Bearer" || !token){
            return res.status(401).json({
                message:"Invalid authorization header"
            });
        }

        const decoded = jwt.verify(
            token,
            authConfig.jwtSecret
        );
        req.user=decoded;
        next();

    }catch(error){
        console.error("Authentication failed", error);

        return res.status(401).json({
            message:"Invalid or expired token"
        });
    }

};