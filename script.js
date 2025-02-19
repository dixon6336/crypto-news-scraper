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

        // 移除 URL 末尾的斜杠和 news
        url = url.replace(/\/?news\/?$/, '').replace(/\/$/, '');

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

            // ... 其余代码保持不变 ...
        }
    } catch (error) {
        // ... 错误处理代码保持不变 ...
    }
}
