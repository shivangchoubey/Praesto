import express from 'express';

const app=express();

const PORT=process.env.PORT || 5000;

app.use(express.json());

app.get('/health',(req,res)=>{
    res.json({
        status:"Ok",
        service:"Praesto-api"
    });

});

app.listen(PORT,()=>{
    console.log(`Praesto Backend is running on http://localhost:${PORT}`);
});