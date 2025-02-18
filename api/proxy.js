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

        // 构建新闻 API URL
        const coinPath = url.split('/currencies/')[1]?.split('/')[0];
        if (!coinPath) {
            throw new Error('无效的币种 URL');
        }

        // 使用 CoinMarketCap 的 GraphQL API
        const apiUrl = 'https://api.coinmarketcap.com/graphql';
        const query = {
            query: `
                query GetLatestNews($slug: String!) {
                    cryptocurrency(slug: $slug) {
                        news(first: 50) {
                            edges {
                                node {
                                    title
                                    description
                                    source
                                    createdAt
                                }
                            }
                        }
                    }
                }
            `,
            variables: {
                slug: coinPath
            }
        };

        console.log('请求 API:', apiUrl);
        console.log('币种:', coinPath);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://coinmarketcap.com',
                'Referer': 'https://coinmarketcap.com/',
                'x-request-id': Date.now().toString()
            },
            body: JSON.stringify(query)
        });

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        console.log('API 响应:', {
            status: response.status,
            hasData: !!data.data,
            hasNews: !!data.data?.cryptocurrency?.news
        });

        // 验证并转换数据
        const newsItems = data.data?.cryptocurrency?.news?.edges?.map(edge => edge.node) || [];
        
        // 转换为 HTML 格式
        const html = `
            <html>
                <body>
                    <div class="news-container">
                        ${newsItems.map(item => `
                            <article>
                                <h3>${item.title || ''}</h3>
                                <div class="meta">
                                    <time datetime="${item.createdAt || ''}">${item.createdAt || ''}</time>
                                    <span class="source">${item.source || 'Unknown'}</span>
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
                url: req.query.url
            } : undefined
        });
    }
}
