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

            this.updateStatus('正在准备抓取...', 10);

            // 使用 cors-anywhere 或类似服务来解决跨域问题
            const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
            const response = await fetch(proxyUrl);
            const html = await response.text();

            this.updateStatus('正在解析数据...', 50);

            // 创建 DOM 解析器
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // 获取新闻数据
            const newsSection = doc.querySelector('div[data-module-name="Coin-News"]');
            if (!newsSection) {
                throw new Error('未找到新闻区域，请确保页面已切换到 News 标签');
            }

            // 获取所有新闻项
            const newsItems = Array.from(newsSection.querySelectorAll('article')).map(item => {
                try {
                    // 获取标题元素
                    const titleElement = item.querySelector('h4');
                    if (!titleElement) return null;

                    // 获取描述（包括完整的描述文本）
                    const descriptionElement = item.querySelector('div[class*="description"]');
                    
                    // 获取来源和时间
                    const sourceElement = item.querySelector('span[data-role="source"]');
                    const timeElement = item.querySelector('time');
                    
                    // 获取时间文本
                    const timeText = timeElement ? timeElement.textContent.trim() : '';
                    // 获取来源文本
                    const sourceText = sourceElement ? sourceElement.textContent.trim() : '';
                    // 获取标题文本
                    const titleText = titleElement.textContent.trim();
                    // 获取完整的描述文本
                    const descriptionText = descriptionElement ? descriptionElement.textContent.trim() : '';

                    // 验证数据完整性
                    if (!titleText || !sourceText) {
                        console.log('跳过无效新闻项:', { titleText, sourceText });
                        return null;
                    }

                    // 构建新闻项对象
                    const newsItem = {
                        title: titleText,
                        description: descriptionText,
                        source: sourceText,
                        time: timeText,
                        // 添加原始时间文本，以便后续处理
                        rawTime: timeElement ? timeElement.getAttribute('datetime') || timeText : timeText
                    };

                    // 记录日志以便调试
                    console.log('解析到新闻:', newsItem);

                    return newsItem;
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
        const now = new Date();
        
        // 英文时间格式
        const englishMatches = timeText.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/i);
        if (englishMatches) {
            const [_, amount, unit] = englishMatches;
            const value = parseInt(amount);

            switch (unit.toLowerCase()) {
                case 'minute':
                    now.setMinutes(now.getMinutes() - value);
                    break;
                case 'hour':
                    now.setHours(now.getHours() - value);
                    break;
                case 'day':
                    now.setDate(now.getDate() - value);
                    break;
                case 'week':
                    now.setDate(now.getDate() - (value * 7));
                    break;
                case 'month':
                    now.setMonth(now.getMonth() - value);
                    break;
                case 'year':
                    now.setFullYear(now.getFullYear() - value);
                    break;
            }
        }

        return now.toISOString();
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new NewsScraperApp();
}); 