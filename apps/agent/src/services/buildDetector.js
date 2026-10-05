import fs from "fs/promises";
import path from "path";

const fileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

const readJsonFile = async (filePath) => {
    const content = await fs.readFile(
        filePath,
        "utf-8"
    );

    return JSON.parse(content);
};

export const detectBuildContract = async ({
    workspacePath
}) => {
    /*
     * 1. Explicit Dockerfile
     *
     * This is our universal escape hatch.
     * Any framework/language can be deployed
     * when the repository provides its own
     * valid Dockerfile.
     */

    const dockerfilePath = path.join(
        workspacePath,
        "Dockerfile"
    );

    if (await fileExists(dockerfilePath)) {
        return {
            type: "dockerfile",
            dockerfilePath
        };
    }

    /*
     * 2. Node.js ecosystem
     */

    const packageJsonPath = path.join(
        workspacePath,
        "package.json"
    );

    if (await fileExists(packageJsonPath)) {
        const packageJson =
            await readJsonFile(packageJsonPath);

        const dependencies = {
            ...(packageJson.dependencies || {}),
            ...(packageJson.devDependencies || {})
        };

        const scripts = packageJson.scripts || {};

        if (dependencies.next) {
            return {
                type: "node",
                framework: "next",
                packageJson
            };
        }

        if (dependencies.vite) {
            return {
                type: "node",
                framework: "vite",
                packageJson
            };
        }

        if (dependencies["react-scripts"]) {
            return {
                type: "node",
                framework: "create-react-app",
                packageJson
            };
        }

        if (scripts.start) {
            return {
                type: "node",
                framework: "node",
                packageJson
            };
        }

        throw new Error(
            "Node.js project detected but no supported start/build contract was found"
        );
    }

    /*
     * 3. Python ecosystem
     */

    const requirementsPath = path.join(
        workspacePath,
        "requirements.txt"
    );

    const pyprojectPath = path.join(
        workspacePath,
        "pyproject.toml"
    );

    if (
        await fileExists(requirementsPath) ||
        await fileExists(pyprojectPath)
    ) {
        return {
            type: "python"
        };
    }

    /*
     * 4. Java / Maven
     */

    const pomPath = path.join(
        workspacePath,
        "pom.xml"
    );

    if (await fileExists(pomPath)) {
        return {
            type: "java",
            buildTool: "maven"
        };
    }

    /*
     * 5. Java / Gradle
     */

    const gradlePath = path.join(
        workspacePath,
        "build.gradle"
    );

    const gradleKtsPath = path.join(
        workspacePath,
        "build.gradle.kts"
    );

    if (
        await fileExists(gradlePath) ||
        await fileExists(gradleKtsPath)
    ) {
        return {
            type: "java",
            buildTool: "gradle"
        };
    }

    /*
     * 6. Go
     */

    const goModPath = path.join(
        workspacePath,
        "go.mod"
    );

    if (await fileExists(goModPath)) {
        return {
            type: "go"
        };
    }

    /*
     * 7. .NET
     */

    const entries = await fs.readdir(
        workspacePath,
        {
            withFileTypes: true
        }
    );

    const hasDotnetProject =
        entries.some(
            (entry) =>
                entry.isFile() &&
                (
                    entry.name.endsWith(".csproj") ||
                    entry.name.endsWith(".fsproj")
                )
        );

    if (hasDotnetProject) {
        return {
            type: "dotnet"
        };
    }

    throw new Error(
        "Praesto could not detect a supported build contract. Add a Dockerfile or use a supported project structure."
    );
};