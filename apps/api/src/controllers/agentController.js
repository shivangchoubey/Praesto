import prisma from "../lib/prisma"

export const createAgent= async (req,res)=>{
try{
    const {
        userId,
        machineName,
        operatingSystem,
        version
    } =req.body;
    const agent= await prisma.agent.create({
        data:{
            userId,
            machineName,
            operatingSystem,
            version
        }
    });
    res.status(201).json({
        message:"Agent created succcessfully",
        agent
    });
}catch(error){
    console.log("Failed to create agent",error);

    res.status(500).json({
        message:"Failed to create agent"
    });
}
};

export const getAgent= async (req,res)=>{
    try{
        const agents= await prisma.agent.findMany();
        res.json({
            agents
        })
    }catch(error){
        console.log("Failed to fetch agents",error);
        res.status(500).json({
            message:"Failed to fetch agents"
        });
    }
};

export const updateHeartbeat = async (req,res)=>{
    try{
        const {id} =req.params;
        const agent= await prisma.agent.update({
            where: {
                id
            },
            data: {
                status:"ONLINE",
                lastHeartbeat:new Date()
            }
        });

        res.json({
            message:"Agent status updated",
            agent
        });
    }catch(error){
        console.log("Failed to update agent heartbeat",error);

        res.status(500).json({
            message:"Failed to update agent heartbeat"
        });
    }
};