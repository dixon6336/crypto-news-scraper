export default async function handler(req, res) {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

        // 使用 CoinMarketCap 的搜索 API
        const apiUrl = 'https://api.coinmarketcap.com/data-api/v3/headlines/news';
        const params = new URLSearchParams({
            symbol: coinSlug.toUpperCase(),
            size: '100',
            interval: '24h',
            timeOrder: 'desc'
        });

        console.log('请求 API:', `${apiUrl}?${params}`);
        console.log('币种:', coinSlug);

        const response = await fetch(`${apiUrl}?${params}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://coinmarketcap.com',
                'Referer': 'https://coinmarketcap.com/',
                'Cache-Control': 'no-cache',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API 错误响应:', errorText);
            throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('API 响应:', {
            status: response.status,
            hasData: !!data.data,
            dataStructure: Object.keys(data.data || {})
        });

        // 验证数据结构
        if (!data.data || !Array.isArray(data.data.headlines)) {
            console.error('返回的数据结构:', data);
            throw new Error('API 返回的数据格式不正确');
        }

        // 转换为 HTML 格式
        const html = `
            <html>
                <body>
                    <div class="news-container">
                        ${data.data.headlines.map(item => `
                            <article>
                                <h3>${item.meta?.title || ''}</h3>
                                <div class="meta">
                                    <time datetime="${item.meta?.updatedAt || ''}">${new Date(item.meta?.updatedAt || '').toLocaleString('zh-CN')}</time>
                                    <span class="source">${item.meta?.sourceUrl || item.meta?.sourceDomain || 'Unknown'}</span>
                                </div>
                                <div class="description">${item.meta?.subtitle || ''}</div>
                                <div class="link"><a href="${item.meta?.sourceUrl || '#'}" target="_blank">阅读原文</a></div>
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
