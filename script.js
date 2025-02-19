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
        // 获取所有必要的 DOM 元素
        this.urlInput = document.getElementById('urlInput');
        this.startDate = document.getElementById('startDate');
        this.endDate = document.getElementById('endDate');
        this.fetchButton = document.getElementById('fetchButton');
        this.downloadButton = document.getElementById('downloadButton');
        this.newsTable = document.getElementById('newsTable');
        this.statusContainer = document.getElementById('statusContainer');
        this.progressBar = document.getElementById('progressBar');
        this.statusText = document.getElementById('statusText');

        // 设置默认日期为今天
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        this.startDate.value = todayStr;
        this.endDate.value = todayStr;

        // 添加事件监听器
        this.fetchButton.addEventListener('click', () => this.fetchNews());
        this.downloadButton.addEventListener('click', () => this.downloadExcel());
    }

    // 更新状态显示方法
    updateStatus(message, progress) {
        if (this.statusContainer) {
            this.statusContainer.style.display = 'block';
        }
        if (this.statusText) {
            this.statusText.textContent = message;
        }
        if (this.progressBar && typeof progress === 'number') {
            this.progressBar.style.width = `${progress}%`;
            this.progressBar.setAttribute('aria-valuenow', progress);
        }
    }

    async fetchNews() {
        try {
            let url = this.urlInput.value.trim();
            if (!url) {
                alert('请输入网址');
                return;
            }

            // 验证 URL 格式
            if (!url.includes('coinmarketcap.com/currencies/')) {
                alert('请输入有效的 CoinMarketCap 币种页面 URL');
                return;
            }

            this.updateStatus('准备抓取...', 0);
            this.progressBar.classList.remove('bg-danger');
            this.downloadButton.disabled = true;
            this.newsTable.innerHTML = '';
            this.newsData = [];

            url = url.replace(/\/?news\/?$/, '').replace(/\/$/, '');
            console.log('处理后的 URL:', url);

            this.updateStatus('正在获取数据...', 30);
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

            try {
                const response = await fetch(proxyUrl);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '抓取失败');
                }

                if (!data.html) {
                    throw new Error('返回数据格式错误');
                }

                this.updateStatus('正在解析数据...', 60);

                // 解析 HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.html, 'text/html');

                // 提取新闻数据
                const newsItems = Array.from(doc.querySelectorAll('article')).map(item => {
                    const title = item.querySelector('h3')?.textContent.trim() || '';
                    const time = item.querySelector('time')?.getAttribute('datetime') || '';
                    const source = item.querySelector('.source')?.textContent.trim() || 'Unknown';
                    const description = item.querySelector('.description')?.textContent.trim() || '';

                    return {
                        title,
                        time,
                        source,
                        description
                    };
                }).filter(item => item.title && item.time);

                this.newsData = newsItems.map(item => ({
                    coin: this.getCoinNameFromUrl(url),
                    title: item.title,
                    source: item.source,
                    description: item.description,
                    date: new Date(item.time).toISOString()
                })).filter(this.filterByDate.bind(this));

                if (this.newsData.length === 0) {
                    this.updateStatus('未找到符合条件的新闻', 100);
                    return;
                }

                this.updateStatus('显示结果...', 90);
                this.displayNews();
                this.downloadButton.disabled = false;
                this.updateStatus(`已找到 ${this.newsData.length} 条新闻`, 100);

            } catch (error) {
                console.error('网络请求错误:', error);
                throw new Error(`请求失败: ${error.message}`);
            }

        } catch (error) {
            console.error('抓取失败:', error);
            this.updateStatus(`抓取失败: ${error.message}`, 100);
            this.progressBar.classList.add('bg-danger');
            alert('抓取失败，请检查网址是否正确，并确保网络连接正常');
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
        
        // 处理 ISO 时间格式
        if (timeText.match(/^\d{4}-\d{2}-\d{2}/)) {
            const date = new Date(timeText);
            return date.toISOString();
        }
        
        // 如果是时间戳
        if (!isNaN(timeText)) {
            const date = new Date(parseInt(timeText));
            return date.toISOString();
        }
        
        // 其他格式保持不变
        return new Date().toISOString();
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成，初始化应用');
    new NewsScraperApp();
}); 
