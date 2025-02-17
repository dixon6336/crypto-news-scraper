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
                const newsSection = doc.querySelector('div[data-module-name="Coin-News"]');
                if (!newsSection) {
                    // 尝试其他可能的选择器
                    const alternativeSelectors = [
                        'div[class*="news"]',
                        'div[class*="article"]',
                        'main',
                        'div[class*="content"]'
                    ];
                    
                    for (const selector of alternativeSelectors) {
                        const element = doc.querySelector(selector);
                        if (element) {
                            console.log('使用备选选择器找到新闻区域:', selector);
                            newsSection = element;
                            break;
                        }
                    }
                    
                    if (!newsSection) {
                        throw new Error('未找到新闻区域，请检查页面结构');
                    }
                }

                // 获取所有新闻项
                const newsItems = Array.from(newsSection.querySelectorAll('article, div[class*="news-item"], div[class*="article"]')).map(item => {
                    try {
                        // 获取标题元素 - 使用多个可能的选择器
                        const titleElement = item.querySelector('h4, h3, h2, [class*="title"]');
                        if (!titleElement) {
                            console.log('跳过：未找到标题元素');
                            return null;
                        }

                        // 获取描述
                        const descriptionElement = item.querySelector('div[class*="description"], p, [class*="content"]');
                        
                        // 获取来源和时间
                        const sourceElement = item.querySelector('span[data-role="source"], [class*="source"], a[class*="source"]');
                        const timeElement = item.querySelector('time, [class*="time"], [datetime]');
                        
                        // 获取时间文本
                        const timeText = timeElement ? (timeElement.getAttribute('datetime') || timeElement.textContent.trim()) : '';
                        // 获取来源文本
                        const sourceText = sourceElement ? sourceElement.textContent.trim() : '未知来源';
                        // 获取标题文本
                        const titleText = titleElement.textContent.trim();
                        // 获取完整的描述文本
                        const descriptionText = descriptionElement ? descriptionElement.textContent.trim() : '';

                        // 记录调试信息
                        console.log('解析新闻项:', {
                            title: titleText,
                            source: sourceText,
                            time: timeText,
                            description: descriptionText.substring(0, 100) + '...'
                        });

                        return {
                            title: titleText,
                            description: descriptionText,
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
        const match = url.match(/currencies\/([^/#]+)/);
        return match ? match[1].toUpperCase() : 'UNKNOWN';
    }

    /**
     * 根据日期过滤新闻
     * @param {NewsItem} item - 新闻项
     * @returns {boolean}
     */
    filterByDate(item) {
        const startDate = new Date(this.startDate.value);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(this.endDate.value);
        endDate.setHours(23, 59, 59, 999);
        
        const itemDate = new Date(item.date);
        
        return itemDate >= startDate && itemDate <= endDate;
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
