
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";

import { checkoutDeployment } from "./services/gitService.js";
import { buildDockerImage } from "./services/dockerService.js";

import {
    startDeploymentContainer,
    waitForContainerHealth,
    stopAndRemoveContainer,
    streamContainerLogs
} from "./services/containerService.js";
import { createProjectRouter } from "./services/routerService.js";
const ROUTER_HOST = "127.0.0.1";
const ROUTER_PORT = Number(
    process.env.PRAESTO_ROUTER_PORT || 4310
);

const projectRouter = createProjectRouter({
    host: ROUTER_HOST,
    port: ROUTER_PORT
});
const API_URL =
    process.env.PRAESTO_API_URL || "http://localhost:5000";

const DATA_FILE = path.join(
    process.cwd(),
    "agent-data.json"
);

const loadAgentData = async () => {
    try {
        const data = await fs.readFile(DATA_FILE, "utf-8");
        return JSON.parse(data);
    } catch {
        return {};
    }
};

const saveAgentData = async (data) => {
    await fs.writeFile(
        DATA_FILE,
        JSON.stringify(data, null, 2),
        "utf-8"
    );
};

const machineName = os.hostname();
const operatingSystem = os.platform();
const version = "1.0.0";

const registerAgentData = async (enrollmentToken) => {
    const response = await fetch(`${API_URL}/agents/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            enrollmentToken,
            machineName,
            operatingSystem,
            version
        })
    });

    if (!response.ok) {
        const body = await response.text();

        throw new Error(
            `Agent registration failed (${response.status}): ${body}`
        );
    }

    const data = await response.json();

    await saveAgentData({
        agentId: data.agent.id,
        token: data.token
    });

    return data;
};

const sendHeartbeat = async (agentToken) => {
    try {
        const response = await fetch(`${API_URL}/agents/heartbeat`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${agentToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Heartbeat failed: ${response.status}`);
        }

        const data = await response.json();

        console.log(
            "Heartbeat Sent:",
            data.agent.lastHeartbeat
        );
    } catch (error) {
        console.error("Heartbeat error:", error.message);
    }
};

const checkForDeployment = async (agentToken) => {
    try {
        const response = await fetch(
            `${API_URL}/agents/deployments/next`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${agentToken}`
                }
            }
        );

        if (response.status === 204) {
            return null;
        }

        if (!response.ok) {
            const body = await response.text();

            throw new Error(
                `Deployment poll failed (${response.status}): ${body}`
            );
        }

        return await response.json();
    } catch (error) {
        console.error("Deployment check error:", error.message);
        return null;
    }
};


const restoreProjectRoutes = async (agentToken) => {
    const response = await fetch(`${API_URL}/agents/routes`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${agentToken}`
        }
    });

    if (!response.ok) {
        const body = await response.text();

        throw new Error(
            `Failed to restore project routes (${response.status}): ${body}`
        );
    }

    const data = await response.json();
    const routes = data.routes ?? [];
console.log(
    "[Praesto Router] API returned routes:",
    JSON.stringify(routes, null, 2)
);


    for (const route of routes) {
        projectRouter.setRoute(
            route.publicSlug,
            route.hostPort
        );

        console.log(
            `[Praesto Router] Restored ${route.publicSlug} -> 127.0.0.1:${route.hostPort}`
        );
    }

    console.log(
        `[Praesto Router] Restored ${routes.length} project route(s)`
    );

    return routes;
};


const sendDeploymentLog = async (
    agentToken,
    deploymentId,
    level,
    message
) => {
    const cleanMessage = String(message ?? "").trim();

    if (!cleanMessage) {
        return;
    }

    const response = await fetch(
        `${API_URL}/agents/deployments/${deploymentId}/logs`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${agentToken}`
            },
            body: JSON.stringify({
                level,
                message: cleanMessage.slice(0, 4000)
            })
        }
    );

    if (!response.ok) {
        const body = await response.text();

        throw new Error(
            `Deployment log request failed (${response.status}): ${body}`
        );
    }
};

const createDeploymentLogWriter = (agentToken, deploymentId) => {
    // Serialize database writes so build-output chunks do not issue
    // many concurrent requests for the same deployment.
    let queue = Promise.resolve();

    const write = (level, message) => {
        const cleanMessage = String(message ?? "").trim();

        if (!cleanMessage) {
            return queue;
        }

        queue = queue
            .then(() =>
                sendDeploymentLog(
                    agentToken,
                    deploymentId,
                    level,
                    cleanMessage
                )
            )
            .catch((error) => {
                console.error(
                    "Failed to send deployment log:",
                    error.message
                );
            });

        return queue;
    };

    return {
        write,
        flush: () => queue
    };
};

const updateDeploymentStatus = async (
    agentToken,
    deploymentId,
    status,
    runtime = null
) => {
    const response = await fetch(
        `${API_URL}/agents/deployments/${deploymentId}/status`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${agentToken}`
            },
            body: JSON.stringify({
                status,
                ...(runtime ?? {})
            })
        }
    );

    if (!response.ok) {
        const body = await response.text();

        throw new Error(
            `Deployment status update failed (${response.status}): ${body}`
        );
    }

    return response.json();
};

let deploymentInProgress = false;

// Keep stream processes alive for the lifetime of this Agent process.
const containerLogStreams = new Map();

const pollForDeployment = async (agentToken) => {
    if (deploymentInProgress) {
        return;
    }

    deploymentInProgress = true;

    let deploymentData = null;
    let logWriter = null;
    let runtime = null;
    let previousRoutePort = null;
    let routeChanged = false;

    try {
        deploymentData = await checkForDeployment(agentToken);

        if (!deploymentData) {
            return;
        }

        const deploymentId = deploymentData.deployment.id;

        logWriter = createDeploymentLogWriter(
            agentToken,
            deploymentId
        );

        console.log("Deployment received:", deploymentId);
        console.log("Commit:", deploymentData.deployment.commitHash);
        console.log("Repository:", deploymentData.project.repositoryName);

        await logWriter.write("INFO", "Deployment received");

        // 1. Fetch and verify the exact requested Git commit.
        const checkoutResult = await checkoutDeployment({
            projectId: deploymentData.deployment.projectId,
            repositoryUrl: deploymentData.project.repositoryUrl,
            commitHash: deploymentData.deployment.commitHash,
            installationToken: deploymentData.github.installationToken
        });

        console.log(
            "Deployment workspace ready:",
            checkoutResult.workspacePath
        );

        await logWriter.write(
            "INFO",
            `Repository checked out at commit ${checkoutResult.commitHash}`
        );

        // 2. Build the Docker image. The image-build implementation
        // remains unchanged; its output is forwarded to the log API.
        const dockerResult = await buildDockerImage({
            workspacePath: checkoutResult.workspacePath,
            deploymentId,
            onLog: (message) => {
                void logWriter.write("INFO", message);
            }
        });

        console.log("Docker image ready:", dockerResult.imageTag);

        await logWriter.write(
            "INFO",
            `Docker image ready: ${dockerResult.imageTag}`
        );

        await logWriter.flush();

        // 3. Start a uniquely named container for this deployment.
        runtime = await startDeploymentContainer({
            imageTag: dockerResult.imageTag,
            deploymentId,
            projectId: deploymentData.deployment.projectId,
            containerPort: dockerResult.containerPort,
            environmentVariables:
                deploymentData.project.environmentVariables
        });

        console.log("Container started:", runtime.containerName);
        console.log("Container port:", runtime.containerPort);
        console.log("Local application port:", runtime.hostPort);

        await logWriter.write(
            "INFO",
            `Container started: ${runtime.containerName}`
        );

        await logWriter.write(
            "INFO",
            `Application is mapped to 127.0.0.1:${runtime.hostPort}`
        );

        await logWriter.write(
            "INFO",
            "Waiting for application health check"
        );

        // 4. Do not mark the deployment RUNNING until it responds.
        const health = await waitForContainerHealth({
            containerName: runtime.containerName,
            hostPort: runtime.hostPort,
            timeoutMs: 90000,
            intervalMs: 2000,
            onLog: (level, message) => {
                void logWriter.write(level, message);
            }
        });

        await logWriter.flush();


    const publicSlug = deploymentData.project.publicSlug;

    if (!publicSlug) {
        throw new Error(
            "Project publicSlug is missing; cannot configure public routing"
        );
    }

    previousRoutePort = projectRouter.setRoute(
        publicSlug,
        runtime.hostPort
    );

    routeChanged = true;

    await logWriter.write(
        "INFO",
        `Public route configured: ${publicSlug} -> 127.0.0.1:${runtime.hostPort}`
    );


        // 5. Persist the actual container ID and port details with
        // the successful deployment status.
        await updateDeploymentStatus(
            agentToken,
            deploymentId,
            "RUNNING",
            runtime
        );

        await logWriter.write(
            "INFO",
            `Deployment is RUNNING. Local URL: ${health.url}`
        );

        console.log(
            "Deployment is RUNNING:",
            health.url
        );

        // 6. Forward application stdout/stderr into persisted deployment
        // logs. Socket.IO delivery will be added in its own milestone.
        const logProcess = streamContainerLogs({
            containerName: runtime.containerName,
            onLog: (level, message) => {
                void logWriter.write(level, message);
            }
        });

        containerLogStreams.set(deploymentId, logProcess);
    } catch (error) {
        console.error(
            "Deployment execution failed:",
            error.message
        );


    if (routeChanged && deploymentData?.project?.publicSlug) {
        const slug = deploymentData.project.publicSlug;

        if (previousRoutePort === null) {
            projectRouter.removeRoute(slug);
        } else {
            projectRouter.setRoute(slug, previousRoutePort);
        }

        console.log(
            `[Praesto Router] Restored previous route for ${slug}`
        );
    }


        if (logWriter) {
            await logWriter.write("ERROR", error.message);
        }

        // A failed startup must not leave an unhealthy container running.
        if (runtime?.containerName) {
            try {
                await stopAndRemoveContainer(runtime.containerName);

                await logWriter?.write(
                    "WARN",
                    "Unhealthy deployment container was removed"
                );
            } catch (cleanupError) {
                console.error(
                    "Container cleanup failed:",
                    cleanupError.message
                );

                await logWriter?.write(
                    "ERROR",
                    `Container cleanup failed: ${cleanupError.message}`
                );
            }
        }

        if (deploymentData?.deployment?.id) {
            try {
                await updateDeploymentStatus(
                    agentToken,
                    deploymentData.deployment.id,
                    "FAILED"
                );
            } catch (statusError) {
                console.error(
                    "Could not mark deployment FAILED:",
                    statusError.message
                );
            }
        }
    } finally {
        await logWriter?.flush();
        deploymentInProgress = false;
    }
};

const agentData = await loadAgentData();

let agent;

if (agentData.agentId && agentData.token) {
    console.log("Existing Agent is found", agentData.agentId);

    agent = {
        id: agentData.agentId,
        token: agentData.token
    };
} else {
    const enrollmentToken = process.env.PRAESTO_ENROLLMENT_TOKEN;

    if (!enrollmentToken) {
        throw new Error(
            "PRAESTO_ENROLLMENT_TOKEN is required to register the Agent"
        );
    }

    const registrationData = await registerAgentData(enrollmentToken);

    agent = {
        id: registrationData.agent.id,
        token: registrationData.token
    };

    console.log("Agent Registered successfully", agent.id);
}
await projectRouter.listen();

console.log(
    `Praesto Router listening at http://${ROUTER_HOST}:${ROUTER_PORT}`
);

try {
    await restoreProjectRoutes(agent.token);
} catch (error) {
    console.error(
        "Could not restore project routes at startup:",
        error.message
    );
}


await sendHeartbeat(agent.token);

setInterval(() => {
    void sendHeartbeat(agent.token);
}, 30000);

void pollForDeployment(agent.token);

setInterval(() => {
    void pollForDeployment(agent.token);
}, 5000);
