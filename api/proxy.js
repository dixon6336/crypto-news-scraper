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
        const coinSlug = url.split('/currencies/')[1]?.split('/')[0];
        if (!coinSlug) {
            throw new Error('无效的币种 URL');
        }

        // 使用 CoinMarketCap 的新闻 API
        const apiUrl = 'https://api.coinmarketcap.com/content/v3/news';
        const params = new URLSearchParams({
            coins: coinSlug,
            page: '1',
            size: '100'
        });

        console.log('请求 API:', `${apiUrl}?${params}`);
        console.log('币种:', coinSlug);

        const response = await fetch(`${apiUrl}?${params}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://coinmarketcap.com',
                'Referer': `https://coinmarketcap.com/currencies/${coinSlug}/news/`,
                'Cache-Control': 'no-cache',
                'x-request-id': Date.now().toString()
            }
        });

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        console.log('API 响应:', {
            status: response.status,
            hasData: !!data.data,
            itemCount: data.data?.items?.length || 0
        });

        // 验证数据结构
        if (!data.data || !Array.isArray(data.data.items)) {
            throw new Error('API 返回的数据格式不正确');
        }

        // 转换为 HTML 格式
        const html = `
            <html>
                <body>
                    <div class="news-container">
                        ${data.data.items.map(item => `
                            <article>
                                <h3>${item.title || ''}</h3>
                                <div class="meta">
                                    <time datetime="${item.createdAt || ''}">${new Date(item.createdAt || '').toLocaleString('zh-CN')}</time>
                                    <span class="source">${item.sourceName || 'Unknown'}</span>
                                </div>
                                <div class="description">${item.description || ''}</div>
                            </article>
                        `).join('')}
                    </div>
                </body>
            </html>
        `;

        res.status(200).json({ html });

    } catch (error) {
        console.error('代理错误:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? {
                stack: error.stack,
                url: req.query.url,
                timestamp: new Date().toISOString()
            } : undefined
        });
    }
}
