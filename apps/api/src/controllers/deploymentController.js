import prisma from "../lib/prisma";

import{
    createInstallationAccessToken,
    getLatestCommitSha
} from "../services/githubService.js";

const makeProjectSlug = (repositoryName) => {
    const slug = String(repositoryName || "praesto-project")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 45);

    return slug || "praesto-project";
};

const ensureProjectPublicAddress = async (project) => {
    if (project.publicSlug && project.publicUrl) {
        return project;
    }

    const baseSlug =
        project.publicSlug || makeProjectSlug(project.repositoryName);

    const saveAddress = (slug) =>
        prisma.project.update({
            where: { id: project.id },
            data: {
                publicSlug: slug,
                publicUrl: `https://${slug}.shares.zrok.io`
            }
        });

    try {
        return await saveAddress(baseSlug);
    } catch (error) {
        if (error.code !== "P2002" || project.publicSlug) {
            throw error;
        }

        // If another project already owns this hostname,
        // generate a deterministic, project-specific suffix.
        const uniqueSlug =
            `${baseSlug.slice(0, 35)}-${project.id.slice(0, 8)}`;

        return await saveAddress(uniqueSlug);
    }
};
export const createDeployment = async(req,res) =>{
    try{
        const {id: projectId} = req.params;
        const userId = req.user.userId;
        let project = await prisma.project.findFirst({
            where:{
                id:projectId,
                userId
            }
        });
        if(!project){
            return res.status(404).json({
                message:"Project not found"
            })
        }

        project = await ensureProjectPublicAddress(project);

        const agent = await prisma.agent.findUnique({
            where:{
                userId
            }
        });
        if(!agent){
            return res.status(404).json({
                message:"No agent is found for this user"
            });
        }

        if(agent.status !=="ONLINE"){
            return res.status(409).json({
                message:"Agent is offline"
            });
        }

        if(!project.installationId || !project.githubRepositoryId){
            return res.status(400).json({
                message:"Project is not connected to GitHub"
            });
        }

        const gitHubConnection= await prisma.gitHubConnection.findUnique({
            where:{
                userId
            }
        });
        if(!gitHubConnection){
            return res.status(404).json({
                message:"GitHub account is not connected"
            });
        }
        const installationToken= await createInstallationAccessToken(
            gitHubConnection.installationId
        );

        const repositoryPath = new URL(project.repositoryUrl).pathname.replace(/^\/+/, "")
                .replace(/\/+$/, "")
                .replace(/\.git$/, "");

        
        const commitHash= await getLatestCommitSha(
            installationToken.token,
            repositoryPath,
            project.defaultBranch
        );

        const deployment = await prisma.deployment.create({
            data:{
                projectId,
                agentId:agent.id,
                commitHash,
                status:"PENDING",
                publicUrl:project.publicUrl
            }
        });

        return res.status(201).json({
            message:"Deployment created successfully",
            project:{
                id:project.id,
                publicSlug:project.publicSlug,
                publicUrl:project.publicUrl
            },
            deployment
        });

    }catch(error){
        console.error(
            "failed to create deployment",
            error
        );
        return res.status(500).json({
            message:"Failed to create deployment"
        });
    }
};