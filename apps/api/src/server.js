import express from 'express';
import prisma from './lib/prisma.js';
import userRoutes from './routes/userRoutes.js'
import agentRoutes from './routes/agentRoutes.js'
import { checkAgentStatus } from './services/agentMonitor.js';
import projectRoutes from "./routes/projectRoutes.js";

const app=express();

const PORT=process.env.PORT || 5000;

app.use(express.json());

app.use("/users",userRoutes);

app.use('/agents',agentRoutes);

app.use('/projects',projectRoutes);

app.get('/health',async(req,res)=>{
try{
    await prisma.$queryRaw`SELECT 1`;

    res.json({
        status:"Ok",
        service:"Praesto-api",
        database:"connected"
    });
} catch (error) {
    console.error("Database Connection failed ",error);

    res.status(500).json({
        status:"Error",
        service:"Praesto-api",
        database:"disconnected"
    });
}
});

app.listen(PORT,()=>{
    console.log(`Praesto Backend is running on http://localhost:${PORT}`);

    checkAgentStatus();

    setInterval(()=>{
        checkAgentStatus();
    },30000);
});