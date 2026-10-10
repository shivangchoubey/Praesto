
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const runDocker = async (args) => {
    try {
        const { stdout } = await execFileAsync(
            "docker",
            args,
            {
                windowsHide: true,
                maxBuffer: 10 * 1024 * 1024
            }
        );

        return stdout.trim();
    } catch (error) {
        const details = [
            error.stderr,
            error.stdout,
            error.message
        ]
            .filter(Boolean)
            .join("\n")
            .trim();

        // Do not include the complete arguments:
        // they can contain environment variable values.
        throw new Error(
            `Docker ${args[0]} failed: ${details}`
        );
    }
};

const resolveContainerPort = async (imageTag, preferredPort) => {
    if (
        Number.isInteger(preferredPort) &&
        preferredPort >= 1 &&
        preferredPort <= 65535
    ) {
        return preferredPort;
    }

    // Images built from a custom Dockerfile may not have
    // a port returned by the build detector. Inspect the image.
    const output = await runDocker([
        "image",
        "inspect",
        "--format",
        "{{json .Config.ExposedPorts}}",
        imageTag
    ]);

    let exposedPorts;

    try {
        exposedPorts = JSON.parse(output);
    } catch {
        throw new Error(
            "Could not determine the application's container port"
        );
    }

    const portDefinitions = Object.keys(exposedPorts || {});
    const selectedPort = portDefinitions.find(
        (entry) => entry.endsWith("/tcp")
    );

    if (!selectedPort) {
        throw new Error(
            "No TCP port was detected. Generated images use their " +
            "detected port; for a custom Dockerfile, add EXPOSE <port>."
        );
    }

    const port = Number(selectedPort.split("/")[0]);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("The detected container port is invalid");
    }

    return port;
};

const normalizeEnvironmentVariables = (variables = []) => {
    if (!Array.isArray(variables)) {
        throw new Error("Project environment variables must be an array");
    }

    return variables.map(({ key, value }) => {
        if (
            typeof key !== "string" ||
            !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
        ) {
            throw new Error(
                `Invalid environment variable name: ${String(key)}`
            );
        }

        return {
            key,
            value: String(value ?? "")
        };
    });
};

export const startDeploymentContainer = async ({
    imageTag,
    deploymentId,
    projectId,
    containerPort,
    environmentVariables = []
}) => {
    const resolvedPort = await resolveContainerPort(
        imageTag,
        containerPort
    );

    const nameSuffix = deploymentId
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, "-");

    const containerName = `praesto-${nameSuffix}`;

    const variables = normalizeEnvironmentVariables(
        environmentVariables
    );

    const args = [
        "run",
        "--detach",
        "--name",
        containerName,
        "--restart",
        "unless-stopped",

        "--label",
        `com.praesto.project-id=${projectId}`,

        "--label",
        `com.praesto.deployment-id=${deploymentId}`,

        // Bind only to loopback. The local tunnel can reach this
        // port, but it is not directly published to the LAN.
        "--publish",
        `127.0.0.1::${resolvedPort}/tcp`
    ];

    for (const variable of variables) {
        args.push(
            "--env",
            `${variable.key}=${variable.value}`
        );
    }

    args.push(imageTag);

    let containerId = null;

    try {
        containerId = await runDocker(args);

        if (!containerId) {
            throw new Error("Docker did not return a container ID");
        }

        // The host port is allocated dynamically by Docker.
        const portOutput = await runDocker([
            "inspect",
            "--format",
            "{{json .NetworkSettings.Ports}}",
            containerName
        ]);

        const portBindings = JSON.parse(portOutput);
        const bindings = portBindings?.[`${resolvedPort}/tcp`];
        const hostPort = Number(bindings?.[0]?.HostPort);

        if (
            !Number.isInteger(hostPort) ||
            hostPort < 1 ||
            hostPort > 65535
        ) {
            throw new Error(
                "Docker started the container but did not expose a valid host port"
            );
        }

        return {
            containerId,
            containerName,
            containerPort: resolvedPort,
            hostPort
        };
    } catch (error) {
        // Avoid leaving behind a half-started container.
        try {
            await runDocker(["rm", "--force", containerName]);
        } catch {
            // Best-effort cleanup.
        }

        throw error;
    }
};

const delay = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

export const waitForContainerHealth = async ({
    containerName,
    hostPort,
    timeoutMs = 90000,
    intervalMs = 2000,
    onLog
}) => {
    const baseUrl = `http://127.0.0.1:${hostPort}`;
    const deadline = Date.now() + timeoutMs;

    let lastFailure = "The application has not responded yet";

    while (Date.now() < deadline) {
        // Prefer an application health endpoint. If it does not exist,
        // check the root route instead.
        for (const route of ["/health", "/"]) {
            try {
                const response = await fetch(
                    `${baseUrl}${route}`,
                    {
                        signal: AbortSignal.timeout(3000),
                        redirect: "manual"
                    }
                );

                const status = response.status;
                await response.body?.cancel().catch(() => {});

                if (status >= 200 && status < 400) {
                    onLog?.(
                        "INFO",
                        `Health check passed at ${route} (HTTP ${status})`
                    );

                    return {
                        url: baseUrl,
                        healthPath: route,
                        status
                    };
                }

                lastFailure = `${route} returned HTTP ${status}`;
            } catch (error) {
                lastFailure = `${route}: ${error.message}`;
            }
        }

        await delay(intervalMs);
    }

    // Capture the application's last logs before the caller removes
    // an unhealthy container.
    try {
        const recentLogs = await runDocker([
            "logs",
            "--tail",
            "50",
            containerName
        ]);

        if (recentLogs) {
            onLog?.(
                "ERROR",
                `Container logs before health-check failure:\n${recentLogs}`
            );
        }
    } catch {
        // Preserve the original health-check failure.
    }

    throw new Error(
        `Container did not become healthy within ${timeoutMs / 1000} seconds. ` +
        `Last check: ${lastFailure}`
    );
};

export const stopAndRemoveContainer = async (containerName) => {
    if (!containerName) {
        return;
    }

    try {
        await runDocker([
            "rm",
            "--force",
            containerName
        ]);
    } catch (error) {
        if (!/no such container/i.test(error.message)) {
            throw error;
        }
    }
};

const emitLog = (callback, level, message) => {
    if (!message.trim()) {
        return;
    }

    try {
        callback(level, message.slice(0, 4000));
    } catch (error) {
        console.error("Container log callback failed:", error.message);
    }
};

export const streamContainerLogs = ({
    containerName,
    onLog
}) => {
    const child = spawn(
        "docker",
        [
            "logs",
            "--follow",
            "--tail",
            "50",
            containerName
        ],
        {
            windowsHide: true
        }
    );

    const attachStream = (stream, level) => {
        let buffer = "";

        stream.on("data", (chunk) => {
            buffer += chunk.toString("utf-8");

            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                emitLog(onLog, level, line);
            }

            // Protect against an application emitting an exceptionally
            // long line without a newline.
            if (buffer.length > 4000) {
                emitLog(onLog, level, buffer);
                buffer = "";
            }
        });

        stream.on("end", () => {
            emitLog(onLog, level, buffer);
            buffer = "";
        });
    };

    attachStream(child.stdout, "INFO");
    attachStream(child.stderr, "ERROR");

    child.on("error", (error) => {
        emitLog(
            onLog,
            "ERROR",
            `Container log stream failed: ${error.message}`
        );
    });

    child.on("close", (code) => {
        if (code !== 0) {
            emitLog(
                onLog,
                "WARN",
                `Container log stream ended with exit code ${code}`
            );
        }
    });

    return child;
};
