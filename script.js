/**
 * @typedef {Object} NewsItem
 * @property {string} coin - 加密货币名称
 * @property {string} title - 新闻标题
 * @property {string} source - 新闻来源
 * @property {string} date - 发布时间
 */

class NewsScraperApp {
    constructor() {
        this.newsData = [];
        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.urlInput = document.getElementById('urlInput');
        this.startDate = document.getElementById('startDate');
        this.endDate = document.getElementById('endDate');
        this.fetchButton = document.getElementById('fetchButton');
        this.downloadButton = document.getElementById('downloadButton');
        this.newsTable = document.getElementById('newsTable');

        // 设置默认日期为今天
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        this.startDate.value = todayStr;
        this.endDate.value = todayStr;

        this.fetchButton.addEventListener('click', () => this.fetchNews());
        this.downloadButton.addEventListener('click', () => this.downloadExcel());

        // 添加进度条相关元素
        this.statusContainer = document.getElementById('statusContainer');
        this.progressBar = document.getElementById('progressBar');
        this.statusText = document.getElementById('statusText');
    }

    // 更新状态的辅助方法
    updateStatus(message, progress) {
        this.statusContainer.style.display = 'block';
        this.statusText.textContent = message;
        if (progress !== undefined) {
            this.progressBar.style.width = `${progress}%`;
        }
    }

    async fetchNews() {
        try {
            let url = this.urlInput.value.trim();
            if (!url) {
                alert('请输入网址');
                return;
            }

            // 重置状态
            this.statusContainer.style.display = 'block';
            this.progressBar.style.width = '0%';
            this.progressBar.classList.remove('bg-danger');
            this.downloadButton.disabled = true;
            this.newsTable.innerHTML = '';
            this.newsData = [];

            // 标准化 URL 格式
            if (!url.includes('/news')) {
                url = url.replace(/\/?$/, '') + '/news/';
            }

            this.updateStatus('正在准备抓取...', 10);
            console.log('处理后的 URL:', url);

            const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30秒超时

            try {
                const response = await fetch(proxyUrl, {
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '抓取失败');
                }

                const data = await response.json();
                
                if (!data.html) {
                    throw new Error('返回数据格式错误');
                }

                this.updateStatus('正在解析数据...', 50);

                // 创建 DOM 解析器
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.html, 'text/html');

                // 获取新闻数据
                let newsSection = doc.querySelector('div[data-module-name="Coin-News"]');
                if (!newsSection) {
                    // 尝试 CoinMarketCap 特定的选择器
                    const cmc_selectors = [
                        'div[class*="sc-aef7b723-0"]',  // 新闻容器
                        'div[class*="news-list"]',
                        'div[class*="latest-news"]',
                        'div[class*="cmc-news"]'
                    ];
                    
                    for (const selector of cmc_selectors) {
                        const element = doc.querySelector(selector);
                        if (element) {
                            console.log('找到新闻区域:', selector);
                            newsSection = element;
                            break;
                        }
                    }
                    
                    if (!newsSection) {
                        throw new Error('未找到新闻区域，请确保在新闻页面');
                    }
                }

                // 获取所有新闻项
                const newsItems = Array.from(newsSection.querySelectorAll([
                    'div[class*="news-item"]',
                    'div[class*="cmc-article"]',
                    'div[class*="sc-aef7b723-0"]',
                    'article'
                ].join(','))).map(item => {
                    try {
                        // 获取标题
                        const titleElement = item.querySelector([
                            'h3[class*="sc-"]',
                            'div[class*="title"]',
                            'a[class*="cmc-link"]'
                        ].join(','));

                        if (!titleElement) {
                            console.log('跳过：未找到标题元素');
                            return null;
                        }

                        // 获取时间
                        const timeElement = item.querySelector([
                            'span[class*="sc-"] time',
                            'div[class*="time"]',
                            'span[class*="date"]',
                            'time',
                            '[datetime]'
                        ].join(','));

                        // 获取来源
                        const sourceElement = item.querySelector([
                            'span[class*="source"]',
                            'a[class*="source"]',
                            'div[class*="publisher"]'
                        ].join(','));

                        const titleText = titleElement.textContent.trim();
                        const timeText = timeElement ? timeElement.getAttribute('datetime') || timeElement.textContent.trim() : '';
                        const sourceText = sourceElement ? sourceElement.textContent.trim() : 'CoinMarketCap';

                        console.log('解析新闻:', {
                            title: titleText,
                            time: timeText,
                            source: sourceText
                        });

                        return {
                            title: titleText,
                            source: sourceText,
                            time: timeText,
                            rawTime: timeText
                        };
                    } catch (e) {
                        console.error('处理新闻项时出错:', e);
                        return null;
                    }
                }).filter(item => {
                    if (!item) return false;
                    
                    // 额外的数据验证
                    const isValid = item.title && item.source && 
                                  item.title.length > 0 && 
                                  item.source.length > 0;
                    
                    if (!isValid) {
                        console.log('过滤掉无效新闻项:', item);
                    }
                    return isValid;
                });

                // 记录找到的新闻数量
                console.log(`共找到 ${newsItems.length} 条有效新闻`);

                this.newsData = newsItems
                    .map(item => ({
                        coin: this.getCoinNameFromUrl(url),
                        title: item.title,
                        source: item.source,
                        date: this.convertRelativeTime(item.time)
                    }))
                    .filter(this.filterByDate.bind(this));

                if (this.newsData.length === 0) {
                    this.updateStatus('在选定的日期范围内没有找到新闻', 100);
                    return;
                }

                this.updateStatus('正在显示结果...', 90);
                this.displayNews();
                this.downloadButton.disabled = false;
                
                this.updateStatus(`成功抓取 ${this.newsData.length} 条新闻`, 100);
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error('请求超时，请重试');
                }
                throw error;
            }

        } catch (error) {
            console.error('抓取失败:', error);
            this.updateStatus(`抓取失败: ${error.message}`, 100);
            this.progressBar.classList.add('bg-danger');
        }
    }

    getCoinNameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            const currencyIndex = pathParts.indexOf('currencies');
            if (currencyIndex !== -1 && pathParts[currencyIndex + 1]) {
                return pathParts[currencyIndex + 1].toUpperCase();
            }
            return '未知币种';
        } catch (e) {
            console.error('解析币种名称失败:', e);
            return '未知币种';
        }
    }

    /**
     * 根据日期过滤新闻
     * @param {NewsItem} item - 新闻项
     * @returns {boolean}
     */
    filterByDate(item) {
        try {
            const newsDate = new Date(item.date);
            const startDate = new Date(this.startDate.value);
            const endDate = new Date(this.endDate.value);
            
            // 设置时间为当天的开始和结束
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            
            return newsDate >= startDate && newsDate <= endDate;
        } catch (e) {
            console.error('日期过滤错误:', e);
            return false;
        }
    }

    /**
     * 显示新闻数据
     */
    displayNews() {
        this.newsTable.innerHTML = this.newsData.map(item => `
            <tr>
                <td>${item.coin}</td>
                <td>
                    <div class="news-title">${item.title}</div>
                    <div class="news-description text-muted small">${item.description || ''}</div>
                </td>
                <td>${item.source}</td>
                <td>${new Date(item.date).toLocaleString('zh-CN')}</td>
            </tr>
        `).join('');
    }

    /**
     * 下载 Excel 文件
     */
    downloadExcel() {
        const excelData = this.newsData.map(item => ({
            '币种': item.coin,
            '标题': item.title,
            '描述': item.description || '',
            '来源': item.source,
            '时间': new Date(item.date).toLocaleString('zh-CN')
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "新闻数据");
        
        const fileName = `crypto_news_${this.startDate.value}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    }

    // 改进相对时间转换方法
    convertRelativeTime(timeText) {
        if (!timeText) return new Date().toISOString();
        
        const now = new Date();
        
        // 处理标准的 ISO 时间格式
        if (timeText.match(/^\d{4}-\d{2}-\d{2}/)) {
            return new Date(timeText).toISOString();
        }
        
        // 处理相对时间
        const patterns = [
            // 英文格式
            {
                regex: /(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/i,
                process: (amount, unit) => {
                    switch (unit.toLowerCase()) {
                        case 'minute': return now.setMinutes(now.getMinutes() - amount);
                        case 'hour': return now.setHours(now.getHours() - amount);
                        case 'day': return now.setDate(now.getDate() - amount);
                        case 'week': return now.setDate(now.getDate() - (amount * 7));
                        case 'month': return now.setMonth(now.getMonth() - amount);
                        case 'year': return now.setFullYear(now.getFullYear() - amount);
                    }
                }
            },
            // 中文格式
            {
                regex: /(\d+)\s*(分钟|小时|天|周|月|年)前/,
                process: (amount, unit) => {
                    switch (unit) {
                        case '分钟': return now.setMinutes(now.getMinutes() - amount);
                        case '小时': return now.setHours(now.getHours() - amount);
                        case '天': return now.setDate(now.getDate() - amount);
                        case '周': return now.setDate(now.getDate() - (amount * 7));
                        case '月': return now.setMonth(now.getMonth() - amount);
                        case '年': return now.setFullYear(now.getFullYear() - amount);
                    }
                }
            }
        ];

        for (const pattern of patterns) {
            const matches = timeText.match(pattern.regex);
            if (matches) {
                const [_, amount, unit] = matches;
                pattern.process(parseInt(amount), unit);
                return now.toISOString();
            }
        }

        // 如果无法解析，返回当前时间
        console.warn('无法解析时间格式:', timeText);
        return now.toISOString();
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new NewsScraperApp();
}); 
