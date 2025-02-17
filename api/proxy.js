export default async function handler(req, res) {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { url } = req.query;
        if (!url) {
            res.status(400).json({ error: '缺少 URL 参数' });
            return;
        }

        // 确保 URL 是有效的
        try {
            new URL(url);
        } catch (e) {
            res.status(400).json({ error: '无效的 URL 格式' });
            return;
        }

        console.log('请求 URL:', url);

        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Sec-Ch-Ua': '"Not_A Brand";v="99", "Google Chrome";v="120"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'cross-site',
                        'Sec-Fetch-User': '?1',
                        'Upgrade-Insecure-Requests': '1',
                        'Referer': 'https://coinmarketcap.com/',
                        'Origin': 'https://coinmarketcap.com',
                        'Cookie': ''
                    },
                    credentials: 'omit',
                    mode: 'cors',
                    timeout: 15000,
                    redirect: 'follow'
                });

                console.log('响应状态:', response.status, response.statusText);
                console.log('响应头:', Object.fromEntries(response.headers.entries()));

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const html = await response.text();
                console.log('响应大小:', html.length);
                console.log('响应内容片段:', html.substring(0, 500));

                if (!html || html.trim().length === 0) {
                    throw new Error('服务器返回空内容');
                }

                // 使用更宽松的内容检查
                if (!html.includes('<html') || !html.includes('</html>')) {
                    console.log('HTML 内容检查失败，尝试解析返回内容...');
                    // 检查是否包含任何新闻相关内容
                    const hasNewsContent = [
                        'news',
                        'article',
                        'content',
                        'title',
                        'time',
                        'date',
                        'source'
                    ].some(keyword => html.toLowerCase().includes(keyword));

                    if (!hasNewsContent) {
                        throw new Error('返回内容中没有找到新闻相关信息');
                    }
                }

                // 添加调试信息
                console.log('页面包含的关键字:', {
                    news: html.includes('news'),
                    article: html.includes('article'),
                    content: html.includes('content'),
                    coinNews: html.includes('Coin-News')
                });

                res.status(200).json({ html });
                return;

            } catch (error) {
                console.error(`第 ${retryCount + 1} 次尝试失败:`, error.message);
                retryCount++;
                
                if (retryCount === maxRetries) {
                    throw new Error(`抓取失败 (${maxRetries} 次尝试): ${error.message}`);
                }
                
                // 指数退避重试
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            }
        }

    } catch (error) {
        console.error('代理错误:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
