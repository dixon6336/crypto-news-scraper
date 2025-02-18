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

        console.log('请求 URL:', url);

        // 直接请求网页
        const response = await fetch(url, {
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
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        
        // 验证内容
        if (!html || html.trim().length === 0) {
            throw new Error('Empty response from server');
        }

        // 记录响应信息
        console.log('响应状态:', response.status);
        console.log('响应大小:', html.length);
        console.log('响应类型:', response.headers.get('content-type'));

        // 检查是否包含新闻内容的关键字
        const hasNewsContent = [
            'news-list',
            'article',
            'news-content',
            'news-item',
            'sc-aef7b723-0'
        ].some(keyword => html.includes(keyword));

        if (!hasNewsContent) {
            console.log('页面内容片段:', html.substring(0, 500));
            throw new Error('未找到新闻内容，请确保URL正确');
        }

        // 返回HTML内容
        res.status(200).json({ html });

    } catch (error) {
        console.error('代理错误:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? {
                stack: error.stack,
                url: req.query.url
            } : undefined
        });
    }
}
