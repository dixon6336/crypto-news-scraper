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

        // 构建 API URL
        const coinSymbol = url.split('/currencies/')[1]?.split('/')[0];
        if (!coinSymbol) {
            throw new Error('无效的币种 URL');
        }

        // 使用 CoinMarketCap 的 API 端点
        const apiUrl = `https://api.coinmarketcap.com/content/v3/news?coins=${coinSymbol}&page=1&size=100`;
        console.log('API URL:', apiUrl);

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
        console.log('API 响应:', {
            status: response.status,
            dataSize: JSON.stringify(data).length,
            itemCount: data.data?.items?.length || 0
        });

        // 转换为 HTML 格式
        const html = `
            <html>
                <body>
                    <div class="news-container">
                        ${data.data.items.map(item => `
                            <article>
                                <h3>${item.title}</h3>
                                <div class="meta">
                                    <time datetime="${item.createdAt}">${item.createdAt}</time>
                                    <span class="source">${item.source}</span>
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
        console.error('API 错误:', error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
