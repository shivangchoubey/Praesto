    import os from 'os';
    import fs from 'fs/promises';
    import path from 'path';


    const API_URL="http://localhost:5000";
    const userId="be057b20-6634-4408-a936-0ef4f8f281bb";

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




    // const data= await response.json();

    // console.log(data);

    const saveAgentData = async(data)=>{
        await fs.writeFile(
            DATA_FILE,
            JSON.stringify(data,null,2),
            "utf-8"
        );
        
    };

    const registerAgentData = async ()=>{
        const response= await fetch(`${API_URL}/agents`,{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            userId,
            machineName,
            operatingSystem,
            version,
        })
    });
        if(!response.ok){
            throw new Error(`Agent registration failed: ${response.status}`);
        }
        const data = await response.json();
        await saveAgentData({
            agentId:data.agent.id
        });
        return data.agent;
    };

    const sendHeartbeat = async(agentId)=>{
        try{
            const response= await fetch(`${API_URL}/agents/${agentId}/heartbeat`,
                {
                    method:"PATCH"
                }
            );

            if(!response.ok){
                throw new Error(`Heartbeat failed: ${response.status}`);
            }
            const data = await response.json();
            console.log("Heartbeat Sent: ",
                data.agent.lastHeartbeat
            );
        }catch(error){
            console.error("Heartbeat error: ",error.message);
        }
    };

    const machineName=os.hostname();
    const operatingSystem=os.platform();
    const version="1.0.0";

    const agentData = await loadAgentData();

    let agent;

    if(agentData.agentId){
        console.log("Existing Agent is found",agentData.agentId);
        agent = {
            id:agentData.agentId
        };
    }else{
        console.log("No Existing Agent is found, Registering.....");

        agent= await registerAgentData();
        console.log("Agent Registered successfully",agent.id);
    }

    await sendHeartbeat(agent.id);

    setInterval(()=>{
        sendHeartbeat(agent.id);
    },30000);
