import { ensureZrokPublicShare } from "./services/zrokService.js";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ZROK_CLI =
    process.env.PRAESTO_ZROK_EXECUTABLE || "zrok2";

const delay = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

const runZrok = async (args, timeout = 15000) => {
    try {
        const { stdout, stderr } = await execFileAsync(
            ZROK_CLI,
            args,
            {
                windowsHide: true,
                timeout,
                maxBuffer: 5 * 1024 * 1024
            }
        );

        return (stdout || stderr || "").trim();
    } catch (error) {
        throw new Error(
            `zrok2 ${args.join(" ")} failed: ${
                error.stderr || error.message
            }`
        );
    }
};

let managedAgentProcess = null;

const getAgentStatus = async () => {
    const output = await runZrok(["agent", "status"], 5000);

    if (!output) {
        throw new Error("Zrok Agent returned empty status output");
    }

    return output;
};

export const ensureZrokAgent = async () => {
    try {
        return await getAgentStatus();
    } catch {
        // Start the agent if it is not responding.
    }

    if (!managedAgentProcess) {
        managedAgentProcess = spawn(
            ZROK_CLI,
            ["agent", "start"],
            {
                windowsHide: true,
                stdio: ["ignore", "pipe", "pipe"]
            }
        );

        managedAgentProcess.stdout.on("data", (chunk) => {
            console.log("[Zrok Agent]", chunk.toString().trimEnd());
        });

        managedAgentProcess.stderr.on("data", (chunk) => {
            console.error("[Zrok Agent]", chunk.toString().trimEnd());
        });

        managedAgentProcess.on("error", (error) => {
            console.error(
                "[Zrok Agent] Could not start:",
                error.message
            );

            managedAgentProcess = null;
        });

        managedAgentProcess.on("close", () => {
            managedAgentProcess = null;
        });
    }

    for (let attempt = 0; attempt < 30; attempt++) {
        await delay(500);

        try {
            return await getAgentStatus();
        } catch {
            // Keep waiting for the agent.
        }
    }

    throw new Error(
        "Zrok Agent did not become ready. Check the CLI and enabled environment."
    );
};

const collectObjects = (value, result = []) => {
    if (!value || typeof value !== "object") {
        return result;
    }

    result.push(value);

    for (const child of Object.values(value)) {
        collectObjects(child, result);
    }

    return result;
};

const collectStrings = (value, result = []) => {
    if (typeof value === "string") {
        result.push(value);
    } else if (Array.isArray(value)) {
        for (const child of value) {
            collectStrings(child, result);
        }
    } else if (value && typeof value === "object") {
        for (const child of Object.values(value)) {
            collectStrings(child, result);
        }
    }

    return result;
};

const findField = (value, names) => {
    if (!value || typeof value !== "object") {
        return null;
    }

    for (const [key, child] of Object.entries(value)) {
        if (
            names.includes(key.toLowerCase()) &&
            typeof child === "string" &&
            child.trim()
        ) {
            return child.trim();
        }
    }

    for (const child of Object.values(value)) {
        const found = findField(child, names);

        if (found) {
            return found;
        }
    }

    return null;
};

const normalizeTarget = (target) =>
    String(target || "").trim().replace(/\/+$/, "");

const findShare = async (slug) => {
    const output = await runZrok(["list", "shares", "--json"]);

    let data;

    try {
        data = JSON.parse(output);
    } catch {
        throw new Error("Could not parse `zrok2 list shares --json` output");
    }

    const endpoint = `${slug}.shares.zrok.io`;

    const candidates = collectObjects(data)
        .filter((item) =>
            collectStrings(item).some((value) =>
                value.toLowerCase().includes(endpoint.toLowerCase())
            )
        )
        .sort(
            (a, b) =>
                JSON.stringify(a).length - JSON.stringify(b).length
        );

    if (candidates.length === 0) {
        return null;
    }

    const record = candidates[0];
    const strings = collectStrings(record);

    const target =
        findField(record, [
            "target",
            "targeturl",
            "target_url",
            "backendtarget"
        ]) ||
        strings.find((value) =>
            /^https?:\/\/(127\.0\.0\.1|localhost):/i.test(value)
        ) ||
        null;

    const token = findField(record, [
        "sharetoken",
        "share_token",
        "token"
    ]);

    return {
        endpoint,
        target,
        token
    };
};

const containsName = (value, wantedName) => {
    if (Array.isArray(value)) {
        return value.some((entry) =>
            containsName(entry, wantedName)
        );
    }

    if (!value || typeof value !== "object") {
        return false;
    }

    if (
        value.name === wantedName ||
        value.Name === wantedName
    ) {
        return true;
    }

    return Object.values(value).some((entry) =>
        containsName(entry, wantedName)
    );
};

const ensureReservedName = async (slug) => {
    const output = await runZrok([
        "list",
        "names",
        "--namespace-token",
        "public",
        "--json"
    ]);

    let names;

    try {
        names = JSON.parse(output);
    } catch {
        throw new Error("Could not parse the Zrok reserved-name list");
    }

    if (containsName(names, slug)) {
        return;
    }

    await runZrok([
        "create",
        "name",
        slug,
        "--namespace-token",
        "public"
    ]);
};

export const ensureZrokPublicShare = async ({
    slug,
    targetUrl
}) => {
    if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new Error("Invalid Zrok project slug");
    }

    if (
        !targetUrl ||
        !/^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(targetUrl)
    ) {
        throw new Error("Invalid local Praesto router URL");
    }

    await ensureZrokAgent();

    const existingShare = await findShare(slug);

    if (existingShare) {
        if (
            normalizeTarget(existingShare.target) ===
            normalizeTarget(targetUrl)
        ) {
            console.log(
                `[Zrok] Reusing existing share: https://${existingShare.endpoint}`
            );

            return `https://${existingShare.endpoint}`;
        }

        if (!existingShare.token) {
            throw new Error(
                `Share ${slug} exists but its token could not be identified. ` +
                "The existing share was left untouched."
            );
        }

        // Release the old share without deleting the reserved name.
        await runZrok([
            "agent",
            "release",
            "share",
            existingShare.token
        ]);

        await delay(1000);
    }

    await ensureReservedName(slug);

    await runZrok([
        "share",
        "public",
        "--headless",
        "--subordinate",
        "--name-selection",
        `public:${slug}`,
        targetUrl
    ]);

    for (let attempt = 0; attempt < 30; attempt++) {
        await delay(1000);

        const share = await findShare(slug);

        if (
            share &&
            normalizeTarget(share.target) ===
            normalizeTarget(targetUrl)
        ) {
            const publicUrl = `https://${share.endpoint}`;

            console.log(`[Zrok] Public share ready: ${publicUrl}`);

            return publicUrl;
        }
    }

    throw new Error(
        `Zrok share ${slug} did not become ready on ${targetUrl}`
    );
};
