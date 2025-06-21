// js/main.js (最终修正、可运行的完整版本)

document.addEventListener('DOMContentLoaded', async () => {
    const navContainer = document.getElementById('main-nav'); // 顶部导航容器
    const contentArea = document.getElementById('content'); // 内容显示区域

    let navData = [];
    let audioPlayer = null; // 声明在外面，以便保持其引用

    // 1. 加载导航数据
    try {
        const response = await fetch('data/navigation.json');
        if (!response.ok) {
            throw new Error(`无法加载导航数据: ${response.statusText} (${response.status})`);
        }
        navData = await response.json();
        console.log('[main.js] 导航数据加载成功。', navData);

    } catch (error) {
        console.error('[main.js] 加载导航数据失败:', error);
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '20px';
        errorDiv.textContent = '抱歉，导航菜单加载失败。请检查文件或网络连接。';
        navContainer.innerHTML = '';
        contentArea.innerHTML = '';
        contentArea.appendChild(errorDiv);
        return;
    }

    // --- 事件监听器 ---

    // 监听 seriesSelected 事件，处理系列概览显示
    document.addEventListener('seriesSelected', (event) => {
        const { seriesId, chapters } = event.detail;
        console.log(`[main.js] 系列 '${seriesId}' 被选中，准备显示概览。`);

        // 【已修正】对模块清理进行防御性调用，这是问题的关键
        // 只有在模块和其方法真实存在时才调用，防止因模块未加载而产生的致命错误
        if (window.EnglishSite?.Glossary?.cleanup) {
            EnglishSite.Glossary.cleanup();
        }
        if (window.EnglishSite?.AudioSync?.cleanup) {
            EnglishSite.AudioSync.cleanup();
        }
        
        // 如果音频播放器存在且可见，隐藏它并停止播放
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src'); // 清除 src，防止再次播放
            audioPlayer.style.display = 'none';
        }

        const currentSeriesName = navData.find(s => s.seriesId === seriesId)?.series || '未知系列';
        let seriesContentHtml = `<h2>${currentSeriesName}</h2>`;
        seriesContentHtml += '<div class="chapter-list-overview">';

        if (chapters && chapters.length > 0) {
            chapters.forEach(chapter => {
                // 确保缩略图路径正确
                const thumbnailUrl = chapter.thumbnail && chapter.thumbnail.trim() !== '' ? chapter.thumbnail : 'images/placeholders/default_thumb.jpg';
                seriesContentHtml += `
                    <div class="chapter-overview-item">
                        <a href="#${chapter.id}" class="overview-chapter-link" data-chapter-id="${chapter.id}">
                            <img src="${thumbnailUrl}" 
                                 loading="lazy" 
                                 alt="${chapter.title}" class="chapter-thumbnail lazy-load"
                                 onerror="this.onerror=null;this.src='images/placeholders/default_thumb.jpg';">
                            <div class="chapter-info">
                                <h3>${chapter.title} ${chapter.audio ? '🎵' : ''}</h3>
                            </div>
                        </a>
                    </div>`;
            });
        } else {
            seriesContentHtml += '<p>该系列暂无章节。</p>';
        }
        seriesContentHtml += '</div>';
        contentArea.innerHTML = seriesContentHtml; // 填充内容区域

        setupLazyLoading(); // 设置懒加载

        // 重新添加事件监听器，确保它只绑定一次到 contentArea
        contentArea.removeEventListener('click', handleOverviewChapterLinkClick);
        contentArea.addEventListener('click', handleOverviewChapterLinkClick);
    });

    // 监听 chapterLoaded 事件，处理章节内容显示及模块初始化
    document.addEventListener('chapterLoaded', async (event) => {
        const { chapterId, hasAudio, chapterData } = event.detail;
        console.log(`[main.js] 章节详情加载完成: ${chapterId}, 是否有音频: ${hasAudio}`);

        // 【已修正】同样进行防御性调用
        if (window.EnglishSite?.Glossary?.cleanup) EnglishSite.Glossary.cleanup();
        if (window.EnglishSite?.AudioSync?.cleanup) EnglishSite.AudioSync.cleanup();
        
        // 【已修正】防御性初始化
        if (window.EnglishSite?.Glossary?.init) EnglishSite.Glossary.init(contentArea, chapterId);
        
        // 设置导航栏中当前章节所属系列的激活状态
        if (window.EnglishSite?.Navigation?.setActiveChapter) EnglishSite.Navigation.setActiveChapter(chapterId);

        // 动态创建或获取音频播放器
        if (!audioPlayer) {
            audioPlayer = document.createElement('audio');
            audioPlayer.id = 'chapter-audio';
            audioPlayer.controls = true;
            contentArea.insertBefore(audioPlayer, contentArea.firstChild);
        }
        
        if (hasAudio) {
            const srtFilePath = `srt/${chapterId}.srt`;
            const audioFilePath = `audio/${chapterId}.mp3`;

            audioPlayer.style.display = 'block';
            audioPlayer.src = audioFilePath;
            audioPlayer.load();

            try {
                const srtResponse = await fetch(srtFilePath);
                if (!srtResponse.ok) throw new Error(`无法加载 SRT 文件: ${srtResponse.statusText}`);
                const srtText = await srtResponse.text();
                // 【已修正】防御性初始化
                if (window.EnglishSite?.AudioSync?.init) EnglishSite.AudioSync.init(contentArea, srtText, audioPlayer);
            } catch (e) {
                console.error('[main.js] 加载或解析 SRT/音频失败:', e);
                const errorDiv = document.createElement('div');
                errorDiv.style.color = 'red';
                errorDiv.textContent = '抱歉，音频或字幕加载失败。';
                contentArea.insertBefore(errorDiv, contentArea.firstChild || null);
                if (window.EnglishSite?.AudioSync?.cleanup) EnglishSite.AudioSync.cleanup();
            }
        } else {
            if (audioPlayer) {
                audioPlayer.style.display = 'none';
                audioPlayer.pause();
                audioPlayer.removeAttribute('src');
            }
            if (window.EnglishSite?.AudioSync?.cleanup) EnglishSite.AudioSync.cleanup();
        }
    });

    // 监听 chapterLoadError 事件，处理章节加载失败情况
    document.addEventListener('chapterLoadError', (event) => {
        const { chapterId, message, originalError } = event.detail;
        console.error(`[main.js] 章节 ${chapterId} 加载遇到错误: ${message}`, originalError);
        // 【已修正】防御性调用
        if (window.EnglishSite?.Glossary?.cleanup) EnglishSite.Glossary.cleanup();
        if (window.EnglishSite?.AudioSync?.cleanup) EnglishSite.AudioSync.cleanup();
        if (audioPlayer) {
            audioPlayer.style.display = 'none';
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
        }
    });

    // 监听 initialChapterLoad 事件，在页面初次加载时处理特定章节的加载
    document.addEventListener('initialChapterLoad', (event) => {
        const { chapterId } = event.detail;
        if (window.EnglishSite?.Navigation?.navigateToChapter) EnglishSite.Navigation.navigateToChapter(chapterId);
    });

    // 监听 popstateChapterLoad 事件，在浏览器前进/后退时处理特定章节的加载
    document.addEventListener('popstateChapterLoad', (event) => {
        const { chapterId } = event.detail;
        if (window.EnglishSite?.Navigation?.navigateToChapter) EnglishSite.Navigation.navigateToChapter(chapterId);
    });

    // --- 核心初始化 ---
    if (window.EnglishSite?.Navigation?.init) {
        EnglishSite.Navigation.init(navContainer, navData);
    } else {
        console.error("致命错误: Navigation 模块未能加载！");
    }

    // --- 辅助函数 ---
    const handleOverviewChapterLinkClick = (event) => {
        let target = event.target;
        while (target && target !== contentArea) {
            if (target.classList.contains('overview-chapter-link')) {
                event.preventDefault();
                const chapterId = target.dataset.chapterId;
                if (window.EnglishSite?.Navigation?.navigateToChapter) EnglishSite.Navigation.navigateToChapter(chapterId);
                return;
            }
            target = target.parentNode;
        }
    };
    
    const setupLazyLoading = () => {
        const lazyImages = contentArea.querySelectorAll('img.lazy-load');
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src || img.src;
                        img.classList.remove('lazy-load');
                        observer.unobserve(img);
                    }
                });
            }, { rootMargin: '0px 0px 50px 0px' });
            lazyImages.forEach(img => observer.observe(img));
        } else {
            lazyImages.forEach(img => {
                img.src = img.dataset.src || img.src;
                img.classList.remove('lazy-load');
            });
        }
    };
});
