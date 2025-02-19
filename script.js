class NewsScraperApp {
    constructor() {
        this.newsData = [];
        this.init();
    }

    init() {
        // ... 其他初始化代码保持不变 ...

        // 确保获取到进度条元素
        this.statusContainer = document.querySelector('#statusContainer');
        this.progressBar = document.querySelector('#progressBar');
        this.statusText = document.querySelector('#statusText');

        if (!this.statusContainer || !this.progressBar || !this.statusText) {
            console.error('找不到进度条元素');
        }

        // 添加点击事件监听器
        this.fetchButton.addEventListener('click', () => {
            console.log('点击抓取按钮');
            this.fetchNews();
        });
    }

    // 更新状态显示方法
    updateStatus(message, progress) {
        console.log('更新状态:', message, progress);
        
        if (this.statusContainer) {
            this.statusContainer.style.display = 'block';
        }
        
        if (this.statusText) {
            this.statusText.textContent = message;
        }
        
        if (this.progressBar && progress !== undefined) {
            this.progressBar.style.width = `${progress}%`;
            this.progressBar.setAttribute('aria-valuenow', progress);
        }
    }

    async fetchNews() {
        try {
            console.log('开始抓取新闻');
            let url = this.urlInput.value.trim();
            if (!url) {
                alert('请输入网址');
                return;
            }

            // 重置状态
            this.updateStatus('准备抓取...', 0);
            this.progressBar.classList.remove('bg-danger');
            this.downloadButton.disabled = true;
            this.newsTable.innerHTML = '';
            this.newsData = [];

            // 移除 URL 末尾的斜杠和 news
            url = url.replace(/\/?news\/?$/, '').replace(/\/$/, '');
            console.log('处理后的 URL:', url);

            this.updateStatus('正在发送请求...', 20);
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

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
                console.log('收到响应数据');

                // ... 其余代码保持不变 ...

            } catch (error) {
                console.error('请求错误:', error);
                if (error.name === 'AbortError') {
                    throw new Error('请求超时，请重试');
                }
                throw error;
            }

        } catch (error) {
            console.error('抓取失败:', error);
            this.updateStatus(`抓取失败: ${error.message}`, 100);
            if (this.progressBar) {
                this.progressBar.classList.add('bg-danger');
            }
        }
    }

    // ... 其他方法保持不变 ...
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成，初始化应用');
    window.app = new NewsScraperApp();
});
