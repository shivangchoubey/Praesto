    import os from 'os';
    import fs from 'fs/promises';
    import path from 'path';


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
