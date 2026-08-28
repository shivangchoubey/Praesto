import prisma from '../lib/prisma';

const OFFLINE_THRESHOLD = 90 * 1000;

export const checkAgentStatus = async ()=>{
    try{
        const threshold= new Date(
            Date.now()- OFFLINE_THRESHOLD
        );
        const result = await prisma.agent.updateMany(
            {
                where:{
                    status:"ONLINE",
                    lastHeartbeat:{
                        lt:threshold
                    }
                },
                data:{
                    status:"OFFLINE"
                }
            });
        if(result.count>0){
            console.log(`${result.count} agents are marked offline`);
        }

    }catch(error){
        console.error(
            "Failed to check agent status",
            error
        )
    }
};