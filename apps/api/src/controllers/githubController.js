import { createInstallationAccessToken,getInstallationRepositories,exchangeCodeForToken,getGitHubUser, findOrCreateUserFromGitHub,saveGitHubConnection ,getGitHubConnectionByUserId} from "../services/githubService";
import { generatePraestoToken } from "../services/authService";

export const githubCallback = async (req,res)=>{
    try{
        const {
            code,
            installation_id,
            setup_action
        } = req.query;

        console.log("Github callback recived:",{
            codeReceived: !!code,
            installation_id:installation_id,
            setup_action:setup_action
        });
        const tokenData= await exchangeCodeForToken(code);

        const githubUser= await getGitHubUser(
            tokenData.access_token
        );
        console.log("Github user received", {
            id:githubUser.id,
            login:githubUser.login
        });
        const praestoUser =await findOrCreateUserFromGitHub(
            githubUser
        );
        console.log("Praesto user found",{
            id:githubUser.id,
            username:praestoUser.username
        });

        const gitHubConnection = await saveGitHubConnection(
            praestoUser.id,
            installation_id
        )
        console.log("Github connection saved",{
            connectionId:gitHubConnection.id,
            userId:gitHubConnection.userId,
            installationId:gitHubConnection.installationId
        });

        const praestoToken= generatePraestoToken(
            praestoUser
        );

        return res.json({
            message:"GitHub authentication successfull",
            token:praestoToken
        });
    }catch(error){
        console.error("Github callback failed",error);
        res.status(500).json({
            message:"GitHub callback failed"
        });
    }
};

export const getRepositories =async (req,res)=>{
    try{
        const userId = req.user.userId;
        
        const githubConnection = await getGitHubConnectionByUserId(userId);
        if(!githubConnection){
            return res.status(401).json({
                message:"Github account is not connected"
            });
        }
        const installationToken= await createInstallationAccessToken(
            githubConnection.installationId
        );
        const repositories= await getInstallationRepositories(
            installationToken.token
        );

        return res.json({
            repositories:repositories.repositories.map(repo =>({
                id:repo.id,
                name:repo.name,
                fullName:repo.full_name,
                defaultBranch:repo.default_branch,
                private:repo.private
            }))
        })
    }catch(error){
        console.error("Failed to fetch repositories",error);
        return res.status(500).json({
            message:"Failed to fetch GitHub repositories"
        });
    }
};
