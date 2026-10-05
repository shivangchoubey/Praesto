import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

import { detectBuildContract } from "./buildDetector.js";

const IMAGE_PREFIX = "praesto-deployment";
const GENERATED_DOCKERFILE = ".praesto.generated.Dockerfile";

const runDocker = async (args, cwd, onLog) => {
    return new Promise((resolve, reject) => {
        const child = spawn(
            "docker",
            args,
            {
                cwd,
                windowsHide: true
            }
        );

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            const message = chunk.toString();

            stdout += message;

            if (onLog) {
                onLog(message);
            }
        });

        child.stderr.on("data", (chunk) => {
            const message = chunk.toString();

            stderr += message;

            if (onLog) {
                onLog(message);
            }
        });

        child.on("error", (error) => {
            reject(
                new Error(
                    `Failed to start Docker: ${error.message}`
                )
            );
        });

        child.on("close", (exitCode) => {
            if (exitCode === 0) {
                resolve({
                    stdout,
                    stderr
                });

                return;
            }

            reject(
                new Error(
                    `Docker command failed with exit code ${exitCode}\n${stderr || stdout}`
                )
            );
        });
    });
};

const writeGeneratedDockerfile = async (
    workspacePath,
    content
) => {
    const dockerfilePath = path.join(
        workspacePath,
        GENERATED_DOCKERFILE
    );

    await fs.writeFile(
        dockerfilePath,
        content,
        "utf-8"
    );

    return dockerfilePath;
};

const buildNodeDockerfile = ({
    framework,
    packageJson
}) => {
    const hasBuildScript = Boolean(
        packageJson?.scripts?.build
    );

    if (framework === "next") {
        return {
            content: [
                "FROM node:22-alpine AS builder",
                "",
                "WORKDIR /app",
                "",
                "COPY package*.json ./",
                "RUN npm ci",
                "",
                "COPY . .",
                "",
                "RUN npm run build",
                "",
                "FROM node:22-alpine",
                "",
                "WORKDIR /app",
                "",
                "ENV NODE_ENV=production",
                "",
                "COPY --from=builder /app ./",
                "",
                "EXPOSE 3000",
                "",
                'CMD ["npm", "start"]',
                ""
            ].join("\n"),

            containerPort: 3000
        };
    }

    if (
        framework === "vite" ||
        framework === "create-react-app"
    ) {
        const outputDirectory =
            framework === "vite"
                ? "dist"
                : "build";

        return {
            content: [
                "FROM node:22-alpine AS builder",
                "",
                "WORKDIR /app",
                "",
                "COPY package*.json ./",
                "RUN npm ci",
                "",
                "COPY . .",
                "",
                "RUN npm run build",
                "",
                "FROM nginx:alpine",
                "",
                `COPY --from=builder /app/${outputDirectory} /usr/share/nginx/html`,
                "",
                "EXPOSE 80",
                "",
                'CMD ["nginx", "-g", "daemon off;"]',
                ""
            ].join("\n"),

            containerPort: 80
        };
    }

    return {
        content: [
            "FROM node:22-alpine AS builder",
            "",
            "WORKDIR /app",
            "",
            "COPY package*.json ./",
            "RUN npm ci",
            "",
            "COPY . .",
            "",
            hasBuildScript
                ? "RUN npm run build"
                : "# No build script detected",
            "",
            "RUN npm prune --omit=dev",
            "",
            "FROM node:22-alpine",
            "",
            "WORKDIR /app",
            "",
            "ENV NODE_ENV=production",
            "",
            "COPY --from=builder /app ./",
            "",
            "EXPOSE 3000",
            "",
            'CMD ["npm", "start"]',
            ""
        ].join("\n"),

        containerPort: 3000
    };
};

const buildPythonDockerfile = () => {
    return {
        content: [
            "FROM python:3.12-slim",
            "",
            "WORKDIR /app",
            "",
            "COPY . .",
            "",
            "RUN pip install --no-cache-dir --upgrade pip",
            "",
            "RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi",
            "",
            "EXPOSE 8000",
            "",
            'CMD ["python", "-m", "http.server", "8000", "--bind", "0.0.0.0"]',
            ""
        ].join("\n"),

        containerPort: 8000
    };
};

const buildMavenDockerfile = () => {
    return {
        content: [
            "FROM maven:3.9-eclipse-temurin-21 AS builder",
            "",
            "WORKDIR /app",
            "",
            "COPY pom.xml .",
            "RUN mvn dependency:go-offline",
            "",
            "COPY . .",
            "RUN mvn -DskipTests package",
            "",
            "FROM eclipse-temurin:21-jre",
            "",
            "WORKDIR /app",
            "",
            "COPY --from=builder /app/target ./target",
            "",
            "EXPOSE 8080",
            "",
            'CMD ["sh", "-c", "java -jar target/*.jar"]',
            ""
        ].join("\n"),

        containerPort: 8080
    };
};

const buildGradleDockerfile = () => {
    return {
        content: [
            "FROM gradle:8-jdk21 AS builder",
            "",
            "WORKDIR /app",
            "",
            "COPY . .",
            "",
            "RUN gradle build -x test",
            "",
            "FROM eclipse-temurin:21-jre",
            "",
            "WORKDIR /app",
            "",
            "COPY --from=builder /app/build/libs ./build/libs",
            "",
            "EXPOSE 8080",
            "",
            'CMD ["sh", "-c", "java -jar build/libs/*.jar"]',
            ""
        ].join("\n"),

        containerPort: 8080
    };
};

const buildGoDockerfile = () => {
    return {
        content: [
            "FROM golang:1.24-alpine AS builder",
            "",
            "WORKDIR /app",
            "",
            "COPY go.mod go.sum* ./",
            "RUN go mod download",
            "",
            "COPY . .",
            "",
            "RUN go build -o app .",
            "",
            "FROM alpine:latest",
            "",
            "WORKDIR /app",
            "",
            "COPY --from=builder /app/app ./app",
            "",
            "EXPOSE 8080",
            "",
            'CMD ["./app"]',
            ""
        ].join("\n"),

        containerPort: 8080
    };
};

const buildDotnetDockerfile = () => {
    return {
        content: [
            "FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder",
            "",
            "WORKDIR /app",
            "",
            "COPY . .",
            "",
            "RUN dotnet restore",
            "RUN dotnet publish -c Release -o /app/publish",
            "",
            "FROM mcr.microsoft.com/dotnet/aspnet:8.0",
            "",
            "WORKDIR /app",
            "",
            "COPY --from=builder /app/publish .",
            "",
            "ENV ASPNETCORE_URLS=http://+:8080",
            "",
            "EXPOSE 8080",
            "",
            'CMD ["dotnet", "PraestoApp.dll"]',
            ""
        ].join("\n"),

        containerPort: 8080
    };
};

const createDockerfileFromContract = async ({
    workspacePath,
    contract
}) => {
    if (contract.type === "dockerfile") {
        return {
            dockerfilePath: contract.dockerfilePath,
            containerPort: null,
            generated: false
        };
    }

    let strategy;

    if (contract.type === "node") {
        strategy = buildNodeDockerfile({
            framework: contract.framework,
            packageJson: contract.packageJson
        });
    } else if (contract.type === "python") {
        strategy = buildPythonDockerfile();
    } else if (
        contract.type === "java" &&
        contract.buildTool === "maven"
    ) {
        strategy = buildMavenDockerfile();
    } else if (
        contract.type === "java" &&
        contract.buildTool === "gradle"
    ) {
        strategy = buildGradleDockerfile();
    } else if (contract.type === "go") {
        strategy = buildGoDockerfile();
    } else if (contract.type === "dotnet") {
        strategy = buildDotnetDockerfile();
    } else {
        throw new Error(
            `No Docker build strategy exists for ${contract.type}`
        );
    }

    const dockerfilePath =
        await writeGeneratedDockerfile(
            workspacePath,
            strategy.content
        );

    return {
        dockerfilePath,
        containerPort: strategy.containerPort,
        generated: true
    };
};

export const buildDockerImage = async ({
    workspacePath,
    deploymentId,
    onLog
}) => {
    const contract =
        await detectBuildContract({
            workspacePath
        });

    if (onLog) {
        onLog(
            `Detected build type: ${contract.type}${contract.framework ? ` (${contract.framework})` : ""}\n`
        );
    }

    const dockerfile =
        await createDockerfileFromContract({
            workspacePath,
            contract
        });

    const imageTag =
        `${IMAGE_PREFIX}:${deploymentId}`;

    try {
        if (onLog) {
            onLog(
                `Starting Docker build: ${imageTag}\n`
            );
        }

        await runDocker(
            [
                "build",
                "--progress=plain",
                "-t",
                imageTag,
                "-f",
                path.basename(
                    dockerfile.dockerfilePath
                ),
                "."
            ],
            workspacePath,
            onLog
        );

        if (onLog) {
            onLog(
                `Docker image built successfully: ${imageTag}\n`
            );
        }

        return {
            imageTag,
            containerPort: dockerfile.containerPort,
            buildType: contract.type,
            framework: contract.framework || null
        };
    } finally {
        if (dockerfile.generated) {
            await fs.rm(
                dockerfile.dockerfilePath,
                {
                    force: true
                }
            );
        }
    }
};