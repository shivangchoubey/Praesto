    import os from 'os';
    import fs from 'fs/promises';
    import path from 'path';
import { checkoutDeployment } from './services/gitService.js';
import { buildDockerImage } from './services/dockerService.js';


    const API_URL="http://localhost:5000";

    const DATA_FILE=path.join(
        process.cwd(),
        "agent-data.json"
    );

    const loadAgentData= async ()=>{
        try{
            const data=await fs.readFile(DATA_FILE,"utf-8");
            return JSON.parse(data);
        }catch{
            return {};
        }
    };


    const saveAgentData = async(data)=>{
        await fs.writeFile(
            DATA_FILE,
            JSON.stringify(data,null,2),
            "utf-8"
        );
        
    };

    const machineName=os.hostname();
    const operatingSystem=os.platform();
    const version="1.0.0";

    const registerAgentData = async (enrollmentToken)=>{
        const response= await fetch(`${API_URL}/agents/register`,{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            enrollmentToken,
            machineName,
            operatingSystem,
            version,
        })
    });
        if(!response.ok){
            const errorData=await response.json();
            throw new Error(errorData.message || `Agent registration failed: ${response.status}`);
        }
        const data = await response.json();

        console.log("Registration response:", data);

        await saveAgentData({
            agentId:data.agent.id,
            token: data.token

        });
        return data;

        
    };

    const sendHeartbeat = async(agentToken)=>{
        try{
            const response= await fetch(`${API_URL}/agents/heartbeat`,
                {
                    method:"PATCH",
                    headers:{
                        Authorization: `Bearer ${agentToken}`
                    }
                }
            );

            if(!response.ok){
                const errorData=await response.json();
                throw new Error(errorData.message || `Heartbeat failed: ${response.status}`);
            }
            const data = await response.json();

            console.log("Heartbeat Sent: ",
                data.agent.lastHeartbeat
            );
        }catch(error){
            console.error("Heartbeat error: ",error.message);
        }
    };

    const checkForDeployment= async (agentToken)=>{
        try{

            const response=await fetch(`${API_URL}/agents/deployments/next`,
                {
                    method:"GET",
                    headers:{
                        Authorization: `Bearer ${agentToken}`
                    }
                });
                if(response.status===204){
                    return null;
                }
                if(!response.ok){
                    const errorData=await response.json();
                    throw new Error(
                        errorData.message || `Deploymnet check failed: ${response.status}`
                    );
                }
                return await response.json();
        }catch(error){
            console.error("Deployment check error:",
                error.message
            );
            return null;
        }
    };
    const sendDeploymentLog=async (agentToken,deploymentId,level,message)=>{
        try{
            await fetch(
                `${API_URL}/agents/deployments/${deploymentId}/logs`,
                {
                    method:"POST",
                    headers:{
                        "Content-Type":"application/json",
                        Authorization:`Bearer ${agentToken}`
                    },
                    body:JSON.stringify({
                        level,
                        message:message.trim()
                    })
                }
            );
        }catch(error){
            console.error("Failed to send deployment log:",
                error
            );
        }
    };
    const updateDeploymentStatus= async(
        agentToken,
        deploymentId,
        status
    )=>{
        try{
            await fetch(
                `${API_URL}/agents/deployments/${deploymentId}/status`,
                {
                    method:"PATCH",
                    headers:{
                        "Content-Type":"application/json",
                        Authorization:`Bearer ${agentToken}`
                    },
                    body:JSON.stringify({
                        status
                    })
                }
            );
        }catch(error){
            console.error("Failed to update deployment status:",
                error
            );
        }
    };
    let deploymentInProgress=false;
    const pollForDeployment= async (agentToken)=>{
        if(deploymentInProgress){
            return;
        }
        const deploymentData=await checkForDeployment(agentToken);

        if(!deploymentData){
            return;
        }
        deploymentInProgress=true;
        const deploymentId=deploymentData.deployment.id;
        try{
            console.log("Deployment received:",
                deploymentId
            );
            console.log("Commit:",
                deploymentData.deployment.commitHash
            );
            console.log("Repository:",
                deploymentData.project.repositoryName
            );

            await sendDeploymentLog(agentToken,deploymentId,"INFO","Deployment recieved");
        
            const result=await checkoutDeployment({
                projectId:deploymentData.deployment.projectId,
                repositoryUrl:deploymentData.project.repositoryUrl,
                commitHash:deploymentData.deployment.commitHash,
                installationToken:deploymentData.github.installationToken
            });
            
            console.log("Deployment workspace ready:",result.workspacePath);
            await sendDeploymentLog(agentToken,deploymentId,"INFO",`Repository checked out at commit ${result.commitHash}`);
            
            const dockerResult=await buildDockerImage({
                workspacePath:result.workspacePath,
                deploymentId,
                onLog:(message)=>{
                    sendDeploymentLog(agentToken,deploymentId,"INFO",message);
                }
            });
            console.log("Docker image ready:",dockerResult.imageTag);
            await sendDeploymentLog(agentToken,deploymentId,"INFO",`Docker image ready: ${dockerResult.imageTag}`);

        }catch(error){
            console.error("Deployment execution failed",error.message);
            await sendDeploymentLog(agentToken,deploymentId,"ERROR",error.message);

            await updateDeploymentStatus(agentToken,deploymentId,"FAILED");
        } finally{
            deploymentInProgress=false;
        }
    };

    const agentData = await loadAgentData();

    let agent;

    if(agentData.agentId && agentData.token){
        console.log("Existing Agent is found",agentData.agentId);
        agent = {
            id:agentData.agentId,
            token:agentData.token
        };
    }else{
        console.log("No Existing Agent is found.");

        const enrollmentToken = process.env.PRAESTO_ENROLLMENT_TOKEN;
        if(!enrollmentToken){
            throw new Error(
                "PRAESTO_ENROLLMENT_TOKEN is required to register the Agent"
            );
        }
        const registrationData= await registerAgentData(enrollmentToken);

        agent= {
            id:registrationData.agent.id,
            token:registrationData.token
        }
        console.log("Agent Registered successfully",agent.id);
    }

    await sendHeartbeat(agent.token);

    setInterval(()=>{
        sendHeartbeat(agent.token);
    },30000);

    await pollForDeployment(agent.token);
    setInterval(()=>{
        pollForDeployment(agent.token);
    },5000);
