
const githubConfig ={
    appId:process.env.GITHUB_APP_ID,
    clientId:process.env.GITHUB_CLIENT_ID,
    clientSecret:process.env.GITHUB_CLIENT_SECRET,
    webhookSecret:process.env.GITHUB_WEBHOOK_SECRET,
    privateKeyPath:process.env.GITHUB_PRIVATE_KEY_PATH
};
export default githubConfig;