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

        // 获取币种符号
        const coinSlug = url.split('/currencies/')[1]?.split('/')[0];
        if (!coinSlug) {
            throw new Error('无效的币种 URL');
        }

        // 首先获取币种 ID
        const searchUrl = `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?slug=${coinSlug}`;
        const searchResponse = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Origin': 'https://coinmarketcap.com',
                'Referer': 'https://coinmarketcap.com/'
            }
        });

        if (!searchResponse.ok) {
            throw new Error(`无法获取币种信息: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();
        const cryptoId = searchData.data?.cryptoCurrencyList?.[0]?.id;
        
        if (!cryptoId) {
            throw new Error('未找到币种信息');
        }

        // 使用币种 ID 获取新闻
        const newsUrl = `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail/news?id=${cryptoId}`;
        const newsResponse = await fetch(newsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://coinmarketcap.com',
                'Referer': `https://coinmarketcap.com/currencies/${coinSlug}/`,
                'Cache-Control': 'no-cache'
            }
        });

        if (!newsResponse.ok) {
            throw new Error(`获取新闻失败: ${newsResponse.status}`);
        }

        const newsData = await newsResponse.json();
        
        if (!newsData.data?.news) {
            console.error('新闻数据结构:', newsData);
            throw new Error('新闻数据格式不正确');
        }

        // 转换为 HTML 格式
        const html = `
            <html>
                <body>
                    <div class="news-container">
                        ${newsData.data.news.map(item => `
                            <article>
                                <h3>${item.title || ''}</h3>
                                <div class="meta">
                                    <time datetime="${item.createdAt || ''}">${new Date(item.createdAt || '').toLocaleString('zh-CN')}</time>
                                    <span class="source">${item.sourceUrl ? new URL(item.sourceUrl).hostname : 'Unknown'}</span>
                                </div>
                                <div class="description">${item.description || ''}</div>
                                <div class="link"><a href="${item.sourceUrl || '#'}" target="_blank">阅读原文</a></div>
                            </article>
                        `).join('')}
                    </div>
                </body>
            </html>
        `;

        res.status(200).json({ html });

    } catch (error) {
        console.error('代理错误:', {
            message: error.message,
            stack: error.stack,
            url: req.query.url
        });
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
