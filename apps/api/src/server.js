import express from 'express';
import prisma from './lib/prisma.js';

const app=express();

const PORT=process.env.PORT || 5000;

app.use(express.json());


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
});