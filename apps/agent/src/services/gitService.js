import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const WORKSPACE_ROOT = path.join(
    os.tmpdir(),
    "praesto-agent",
    "workspaces"
);

    const runGit = async (args, cwd, installationToken) => {
    const credentials = Buffer
        .from(`x-access-token:${installationToken}`)
        .toString("base64");

    const env = {
        ...process.env,

        GIT_CONFIG_COUNT: "1",

        GIT_CONFIG_KEY_0: "http.extraheader",

        GIT_CONFIG_VALUE_0:
            `AUTHORIZATION: basic ${credentials}`
    };

    const result = await execFileAsync(
        "git",
        args,
        {
            cwd,
            env,
            maxBuffer: 20 * 1024 * 1024
        }
    );

    return result.stdout.trim();
};

const ensureWorkspaceRoot = async () => {
    await fs.mkdir(
        WORKSPACE_ROOT,
        {
            recursive: true
        }
    );
};

export const checkoutDeployment = async ({
    projectId,
    repositoryUrl,
    commitHash,
    installationToken
}) => {
    await ensureWorkspaceRoot();

    const workspacePath = path.join(
        WORKSPACE_ROOT,
        projectId
    );

    const gitPath = path.join(
        workspacePath,
        ".git"
    );

    let workspaceExists = false;

    try {
        await fs.access(gitPath);
        workspaceExists = true;
    } catch {
        workspaceExists = false;
    }

    if (!workspaceExists) {
        console.log(
            "No existing repository found. Cloning repository..."
        );

        await fs.rm(
            workspacePath,
            {
                recursive: true,
                force: true
            }
        );

        await runGit(
            [
                "clone",
                repositoryUrl,
                workspacePath
            ],
            process.cwd(),
            installationToken
        );
    } else {
        console.log(
            "Existing repository found. Fetching latest changes..."
        );

        await runGit(
            [
                "remote",
                "set-url",
                "origin",
                repositoryUrl
            ],
            workspacePath,
            installationToken
        );

        await runGit(
            [
                "fetch",
                "--prune",
                "origin"
            ],
            workspacePath,
            installationToken
        );
    }

    await runGit(
        [
            "reset",
            "--hard"
        ],
        workspacePath,
        installationToken
    );

    await runGit(
        [
            "clean",
            "-fd"
        ],
        workspacePath,
        installationToken
    );

    console.log(
        `Checking out commit ${commitHash}...`
    );

    await runGit(
        [
            "checkout",
            "--force",
            commitHash
        ],
        workspacePath,
        installationToken
    );

    const checkedOutCommit = await runGit(
        [
            "rev-parse",
            "HEAD"
        ],
        workspacePath,
        installationToken
    );

    if (checkedOutCommit !== commitHash) {
        throw new Error(
            `Git checkout verification failed. Expected ${commitHash}, got ${checkedOutCommit}`
        );
    }

    console.log(
        `Repository checked out successfully at ${checkedOutCommit}`
    );

    return {
        workspacePath,
        commitHash: checkedOutCommit
    };
};