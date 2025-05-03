import axios from 'axios';
import { Wallet, verifyMessage } from 'ethers';
// import dotenv from 'dotenv'; // 不再需要 dotenv
import https from 'https';
import fs from 'fs'; // 引入文件系统模块

// // 加载 .env 文件中的环境变量
// dotenv.config(); // 不再需要加载 .env

const LOGIN_URL = "https://quest.somnia.network/api/auth/onboard";
const SIGN_MESSAGE_PAYLOAD = { onboardingUrl: "https://quest.somnia.network" };

// 如果需要通过代理访问，请取消下面的注释并配置代理地址
// 注意：axios 默认不支持 SOCKS 代理，需要额外库如 'axios-socks-proxy-agent'
// 如果是 HTTP/HTTPS 代理，可以这样配置：
// const httpsAgent = new https.Agent({
//   proxy: 'http://127.0.0.1:10808', // 替换为你的 HTTP/HTTPS 代理地址
//   rejectUnauthorized: false // 如果代理服务器证书有问题，可以尝试设置为 false
// });
// 如果不需要代理，则 agent 为 undefined
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // 忽略 SSL 证书验证，如果需要的话
});

async function loginWithGetInfo() {
    console.log("开始执行登录流程...");

    try {
        // 1. 从 pk.txt 文件读取私钥
        let privateKey;
        try {
            privateKey = fs.readFileSync('pk.txt', 'utf8').trim();
        } catch (readError) {
            if (readError.code === 'ENOENT') {
                console.error("错误：未找到 pk.txt 文件。请确保该文件存在于脚本所在目录。");
            } else {
                console.error("错误：读取 pk.txt 文件时出错:", readError.message);
            }
            return null;
        }

        if (!privateKey || privateKey === "请在此处替换为你的钱包私钥") {
            console.error("错误：请先在 pk.txt 文件中填入你的钱包私钥。");
            return null;
        }

        // 确保私钥前缀是 '0x'
        const pkWithPrefix = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

        // 2. 从私钥创建钱包实例
        const wallet = new Wallet(pkWithPrefix);
        const walletAddress = await wallet.getAddress();
        console.log(`钱包地址: ${walletAddress}`);

        // 3. 准备签名消息 (需要序列化为 JSON 字符串)
        // 注意：ethers v6 的 signMessage 会自动添加 EIP-191 前缀，所以我们直接签原始 JSON 字符串
        const messageString = JSON.stringify(SIGN_MESSAGE_PAYLOAD);
        console.log(`待签名消息: ${messageString}`);

        // 4. 使用私钥签名消息
        const signature = await wallet.signMessage(messageString);
        console.log(`签名: ${signature}`);

        // (可选) 验证签名是否正确
        // const recoveredAddress = verifyMessage(messageString, signature);
        // console.log(`恢复的地址: ${recoveredAddress}`);
        // if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        //     console.error("错误：签名验证失败！");
        //     return null;
        // }

        // 5. 构造请求 payload
        const payload = {
            signature: signature,
            walletAddress: walletAddress
        };
        console.log(`请求 Payload: ${JSON.stringify(payload)}`);

        // 6. 发送 POST 请求
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Origin': 'https://quest.somnia.network',
            'Referer': 'https://quest.somnia.network/',
        };
        console.log(`使用请求头: ${JSON.stringify(headers)}`);

        const response = await axios.post(LOGIN_URL, payload, {
            headers: headers,
            httpsAgent: httpsAgent // 应用 httpsAgent (包含代理或 SSL 设置)
        });

        // 7. 处理响应
        const responseData = response.data;
        const token = responseData?.token;

        if (token) {
            console.log(`登录成功！Token: ${token}`);
            return token;
        } else {
            console.error(`登录失败，未获取到 token。响应内容: ${JSON.stringify(responseData)}`);
            return null;
        }

    } catch (error) {
        console.error("发生错误:", error.message);
        if (axios.isAxiosError(error)) {
            console.error("Axios 错误详情:");
            if (error.response) {
                // 服务器返回了响应，但状态码不在 2xx 范围
                console.error(`服务器响应状态码: ${error.response.status}`);
                console.error(`服务器响应数据: ${JSON.stringify(error.response.data)}`);
                console.error(`服务器响应头: ${JSON.stringify(error.response.headers)}`);
            } else if (error.request) {
                // 请求已发出，但没有收到响应
                console.error("未收到服务器响应，请求详情:", error.request);
            } else {
                // 设置请求时发生了一些事情，触发了错误
                console.error('请求设置错误:', error.message);
            }
            // console.error("Axios 配置:", error.config);
        } else if (error.code === 'INVALID_ARGUMENT' && error.message.includes('private key')) { // 更通用的私钥错误检查
            console.error("错误：提供的私钥格式无效，请检查 pk.txt 中的内容。");
        } else {
            // 其他类型的错误
            console.error("非 Axios 错误详情:", error);
        }
        return null;
    }
}

// 获取用户个人信息的函数
async function getUserInfo(token) {
    if (!token) {
        console.error("错误：未提供有效的token，无法获取用户信息");
        return null;
    }

    try {
        const USER_INFO_URL = "https://quest.somnia.network/api/users/me";
        
        // 构建请求头，在现有基础上添加authorization
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Origin': 'https://quest.somnia.network',
            'Referer': 'https://quest.somnia.network/',
            'Authorization': token // 添加token到请求头
        };

        // 发送GET请求获取用户信息
        const response = await axios.get(USER_INFO_URL, {
            headers: headers,
            httpsAgent: httpsAgent // 应用相同的httpsAgent
        });

        // 返回用户信息数据
        return response.data;
    } catch (error) {
        console.error("获取用户信息时发生错误:", error.message);
        if (axios.isAxiosError(error)) {
            if (error.response) {
                console.error(`服务器响应状态码: ${error.response.status}`);
                console.error(`服务器响应数据: ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                console.error("未收到服务器响应");
            }
        }
        return null;
    }
}

// 打印用户信息的函数
function printUserInfo(userInfo) {
    if (!userInfo) {
        console.error("错误：无法打印用户信息，数据为空");
        return;
    }

    console.log("
===== 用户信息 =====");
    
    // 1. 检查社交媒体绑定状态
    console.log("
社交媒体绑定状态:");
    console.log(`Discord: ${userInfo.discordName ? userInfo.discordName : '未绑定'}`);
    console.log(`Twitter: ${userInfo.twitterName ? userInfo.twitterName : '未绑定'}`);
    console.log(`Telegram: ${userInfo.telegramName ? userInfo.telegramName : '未绑定'}`);
    
    // 2. 检查是否被标记为bot
    console.log("
Bot标记状态:");
    console.log(`账户状态: ${userInfo.isBot ? '已被标记为Bot' : '正常地址'}`);
    
    // 3. 打印邀请分数和人数
    console.log("
邀请信息:");
    console.log(`邀请人数: ${userInfo.referralCount}`);
    console.log(`邀请分数: ${userInfo.referralPoint}`);
    
    console.log("
==================
");
}

// 执行登录函数并获取用户信息
loginWithGetInfo().then(async token => {
    if (token) {
        console.log("登录流程执行完毕。");
        
        // 获取并打印用户信息
        const userInfo = await getUserInfo(token);
        if (userInfo) {
            printUserInfo(userInfo);
        } else {
            console.log("获取用户信息失败。");
        }
    } else {
        console.log("登录流程失败。");
    }
});