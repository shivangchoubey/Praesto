
import http from "node:http";

export const createProjectRouter = ({
    host = "127.0.0.1",
    port = 4310
} = {}) => {
    const routes = new Map();
    let server;

    const handler = (req, res) => {
        let parsedUrl;

        try {
            parsedUrl = new URL(
                req.url || "/",
                `http://${req.headers.host || `${host}:${port}`}`
            );
        } catch {
            res.writeHead(400);
            res.end("Invalid request URL");
            return;
        }

        if (parsedUrl.pathname === "/__praesto_router_health") {
            res.writeHead(200, {
                "Content-Type": "application/json"
            });

            res.end(JSON.stringify({
                status: "ok",
                service: "praesto-router"
            }));

            return;
        }

        const match = parsedUrl.pathname.match(
            /^\/p\/([a-z0-9-]+)(\/.*)?$/i
        );

        if (!match) {
            res.writeHead(404, {
                "Content-Type": "text/plain"
            });

            res.end("Unknown Praesto project route");
            return;
        }

        const slug = match[1];
        const targetPort = routes.get(slug);

        if (!targetPort) {
            res.writeHead(503, {
                "Content-Type": "text/plain"
            });

            res.end("This Praesto application is not currently available");
            return;
        }

        // Remove the internal /p/:slug prefix before forwarding.
        const upstreamPath = match[2] || "/";
        const requestPath = `${upstreamPath}${parsedUrl.search}`;

        const proxyRequest = http.request({
            hostname: "127.0.0.1",
            port: targetPort,
            method: req.method,
            path: requestPath,
            headers: {
                ...req.headers,
                host: `127.0.0.1:${targetPort}`,
                "x-forwarded-host": req.headers.host || "",
                "x-forwarded-proto": "https",
                "x-praesto-project": slug
            }
        }, (proxyResponse) => {
            res.writeHead(
                proxyResponse.statusCode || 502,
                proxyResponse.headers
            );

            proxyResponse.pipe(res);
        });

        proxyRequest.on("error", (error) => {
            console.error(
                `[Praesto Router] ${slug}:`,
                error.message
            );

            if (!res.headersSent) {
                res.writeHead(502, {
                    "Content-Type": "text/plain"
                });
            }

            res.end("Praesto application is temporarily unavailable");
        });

        req.on("aborted", () => proxyRequest.destroy());
        req.pipe(proxyRequest);
    };

    return {
        async listen() {
            if (server?.listening) return;

            server = http.createServer(handler);

            await new Promise((resolve, reject) => {
                server.once("error", reject);

                server.listen(port, host, () => {
                    server.removeListener("error", reject);
                    resolve();
                });
            });
        },

        setRoute(slug, targetPort) {
            if (
                !Number.isInteger(targetPort) ||
                targetPort < 1 ||
                targetPort > 65535
            ) {
                throw new Error("Invalid project host port");
            }

            const previousPort = routes.get(slug) ?? null;
            routes.set(slug, targetPort);

            return previousPort;
        },

        getRoute(slug) {
            return routes.get(slug) ?? null;
        },

        removeRoute(slug) {
            routes.delete(slug);
        },

        targetUrl(slug) {
            return `http://${host}:${port}/p/${slug}`;
        }
    };
};
