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

        // 使用新的 API 端点
        const apiUrl = 'https://api.coinmarketcap.com/data-api/v3/cryptocurrency/market-pairs/latest';
        const params = new URLSearchParams({
            slug: coinSlug,
            category: 'news',
            limit: 100,
            newsCategory: 'ALL'
        });

        console.log('请求 API:', `${apiUrl}?${params}`);

        const response = await fetch(`${apiUrl}?${params}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://coinmarketcap.com',
                'Referer': `https://coinmarketcap.com/currencies/${coinSlug}/`,
                'Cache-Control': 'no-cache',
                'x-request-id': Date.now().toString()
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API 响应错误:', {
                status: response.status,
                statusText: response.statusText,
                errorText,
                url: `${apiUrl}?${params}`
            });
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        
        // 验证并提取新闻数据
        if (!data.data?.news) {
            // 尝试直接抓取网页
            const webpageUrl = `https://coinmarketcap.com/currencies/${coinSlug}/news/`;
            const webResponse = await fetch(webpageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });

            if (!webResponse.ok) {
                throw new Error('无法获取新闻数据');
            }

            const htmlText = await webResponse.text();
            
            // 提取新闻数据
            const newsRegex = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/;
            const match = htmlText.match(newsRegex);
            
            if (match && match[1]) {
                const pageData = JSON.parse(match[1]);
                data.data = {
                    news: pageData.props?.pageProps?.news || []
                };
            } else {
                throw new Error('未找到新闻数据');
            }
        }

        // 转换为 HTML 格式
        const html = `
            <html>
                <body>
                    <div class="news-container">
                        ${data.data.news.map(item => `
                            <article>
                                <h3>${item.title || ''}</h3>
                                <div class="meta">
                                    <time datetime="${item.createdAt || ''}">${new Date(item.createdAt || '').toLocaleString('zh-CN')}</time>
                                    <span class="source">${item.sourceName || item.source || 'Unknown'}</span>
                                </div>
                                <div class="description">${item.description || item.subtitle || ''}</div>
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
