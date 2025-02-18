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

        // 从 URL 中提取币种符号
        const coinSymbol = url.split('/currencies/')[1]?.split('/')[0];
        if (!coinSymbol) {
            throw new Error('无效的币种 URL');
        }

        // 使用 CoinMarketCap 的新闻 API
        const apiUrl = `https://api.coinmarketcap.com/content/v3/news?coins=${coinSymbol}&page=1&size=100`;
        console.log('请求 API:', apiUrl);

        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://coinmarketcap.com/',
                'x-request-id': Date.now().toString(),
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        console.log('API 响应状态:', response.status);
        console.log('API 响应数据结构:', Object.keys(data));

        // 验证数据结构
        if (!data || !data.data || !Array.isArray(data.data.items)) {
            console.error('API 返回的数据结构:', data);
            throw new Error('API 返回的数据格式不正确');
        }

        const newsItems = data.data.items;
        console.log(`找到 ${newsItems.length} 条新闻`);

        // 转换为 HTML 格式
        const html = `
            <html>
                <body>
                    <div class="news-container">
                        ${newsItems.map(item => {
                            // 确保所有字段都存在，使用空字符串作为默认值
                            const title = item.title || '';
                            const source = item.source || 'Unknown';
                            const createdAt = item.createdAt || new Date().toISOString();
                            const description = item.description || '';
                            
                            return `
                                <article>
                                    <h3>${title}</h3>
                                    <div class="meta">
                                        <time datetime="${createdAt}">${createdAt}</time>
                                        <span class="source">${source}</span>
                                    </div>
                                    <div class="description">${description}</div>
                                </article>
                            `;
                        }).join('')}
                    </div>
                </body>
            </html>
        `;

        res.status(200).json({ html });

    } catch (error) {
        console.error('API 错误:', error);
        // 返回更详细的错误信息
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? {
                stack: error.stack,
                url: req.query.url
            } : undefined
        });
    }
}
