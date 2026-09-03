import "dotenv/config";
import fs from 'fs/promises';
import jwt from "jsonwebtoken";
import githubConfig from '../config/github';
import prisma from "../lib/prisma";
const getPrivateKey = async ()=>{
    return await fs.readFile(
        githubConfig.privateKeyPath,
        "utf-8"
    );
};

export const generateAppJWT= async ()=>{
    const privateKey = await getPrivateKey();
    const now =Math.floor(Date.now()/1000);

    return jwt.sign(
    {
        iat: now - 60,
        exp:now + (10*60),
        iss:githubConfig.appId
    },
    privateKey,
    {
        algorithm:"RS256"
    }
  );
};
export const getGitHubApp = async ()=>{
    const token = await generateAppJWT();

    const response = await fetch("https://api.github.com/app",{
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    });
    if(!response.ok){
        throw new Error(`GitHub App request failed: ${response.status}`);

    }
    return await response.json();
};

export const exchangeCodeForToken = async (code) => {
    const params = new URLSearchParams({
        client_id: githubConfig.clientId,
        client_secret: githubConfig.clientSecret,
        code,
        redirect_uri: "http://localhost:5000/github/callback"
    });

    const response = await fetch(
        `https://github.com/login/oauth/access_token?${params.toString()}`,
        {
            method: "POST",
            headers: {
                Accept: "application/json"
            }
        }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
        console.error("GitHub token exchange error:", {
            status: response.status,
            error: data.error,
            errorDescription: data.error_description
        });

        throw new Error(
            `GitHub token exchange failed: ${response.status}`
        );
    }

    return data;
};

export const getGitHubUser = async (accessToken)=>{
    const response = await fetch("https://api.github.com/user",{
        headers:{
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    });
    if(!response.ok){
        throw new Error(
            `Failed to fetch GitHub user: ${response.status}`
        );
    }
    return await response.json();
}
export const findOrCreateUserFromGitHub = async (githubUser)=>{

    const existingUser= await prisma.user.findUnique({
        where:{
            githubId:String(githubUser.id)
        }
    });
    if(existingUser){
        return existingUser;
    }
    return await prisma.user.create({
        data:{
            githubId:String(githubUser.id),
            username:githubUser.login,
            email:githubUser.email ?? "",
            avatarUrl:githubUser.avatar_url
        }   
    });
};

export const createInstallationAccessToken = async (installationId)=>{
    const token = await generateAppJWT();
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`,
        {
            method:"POST",
            headers:{
                Authorization:`Bearer ${token}`,
                Accept:"application/vnd.github+json",
                "X-GitHub-Api-Version":"2022-11-28"
            }
        }
    );

    if(!response.ok){
        throw new Error(
            `Installation token creation failed ${response.status}`
        );
    }

    return await response.json();
};

export const getPraestoUserByGitHubId = async (githubId)=>{
    return await prisma.user.findUnique({
        where:{
            githubId:String(githubId)
        }
    });
};

export const getInstallationRepositories = async (installationToken)=>{

    const response= await fetch("https://api.github.com/installation/repositories",
        {
            headers:{
                Authorization:`Bearer ${installationToken}`,
                Accept:"application/vnd.github+json",
                "X-GitHub-Api-Version":"2022-11-28"
            }
        }
    );
    if(!response.ok){
       const errorData = await response.json();


        throw new Error(
            `Failed to fetch repositories: ${response.status}`
        );
    }
    return await response.json();
};
export const getInstallationRepositoriesById= async(installationToken,repositoryId)=>{
    const repositories = await getInstallationRepositories(
        installationToken
    );
    return repositories.repositories.find(
        repo=> String(repo.id) === String(repositoryId)
    );
};
export const saveGitHubConnection = async (userId,installationId)=>{
    return await prisma.gitHubConnection.upsert({
        where:{
            userId
        },
        update:{
            installationId
        },
        create:{
            userId,
            installationId
        }
    });
};

export const getGitHubConnectionByUserId = async (userId)=>{
    return await prisma.gitHubConnection.findUnique({
        where:{
            userId
        }
    });
};