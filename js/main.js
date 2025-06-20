document.addEventListener('DOMContentLoaded', async () => {
    const navContainer = document.getElementById('main-nav');
    const contentArea = document.getElementById('content');
    const glossaryPopup = document.getElementById('glossary-popup');

    let navData = [];
    let audioPlayer = null; // 声明并初始化音频播放器变量，方便后续管理

    // --- 步骤 1: 加载导航数据 ---
    try {
        const response = await fetch('data/navigation.json');
        if (!response.ok) {
            throw new Error(`无法加载导航数据: ${response.statusText} (${response.status})`);
        }
        navData = await response.json();
        console.log('[main.js] 导航数据加载成功。');

        // 为每个章节对象添加其所属系列的 seriesId，方便后续查找
        navData.forEach(series => {
            series.chapters.forEach(chapter => {
                chapter.seriesId = series.seriesId;
            });
        });

    } catch (error) {
        console.error('[main.js] 加载导航数据失败:', error);
        // 如果导航数据加载失败，在内容区域显示错误信息并阻止后续初始化
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '20px';
        errorDiv.style.border = '1px solid red';
        errorDiv.style.margin = '20px auto';
        errorDiv.style.maxWidth = '600px';
        errorDiv.textContent = '抱歉，导航菜单加载失败。请检查文件或网络连接。';
        navContainer.innerHTML = ''; // 清空导航区域
        contentArea.innerHTML = ''; // 清空内容区域
        contentArea.appendChild(errorDiv);
        return; // 阻止后续代码执行
    }

    // --- 步骤 2: 初始化导航模块 ---
    // 将加载到的 navData 传递给 Navigation 模块进行初始化
    EnglishSite.Navigation.init(navContainer, contentArea, navData);

    // --- 步骤 3: 监听 'seriesSelected' 自定义事件 ---
    // 当 Navigation 模块发出系列被选中的事件时，处理系列概览页面的渲染
    document.addEventListener('seriesSelected', (event) => {
        const { seriesId, chapters } = event.detail;
        console.log(`[main.js] 系列 '${seriesId}' 被选中，准备显示概览。`);

        // 从章节详情页切换到系列概览页时，清理旧的模块状态
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();

        // 查找当前系列的完整名称
        const currentSeriesName = navData.find(s => s.seriesId === seriesId)?.series || '未知系列';
        let seriesContentHtml = `<h2>${currentSeriesName}</h2>`;
        seriesContentHtml += '<div class="chapter-list-overview">'; // 概览列表的容器

        if (chapters && chapters.length > 0) {
            chapters.forEach(chapter => {
                // 为每个章节生成包含缩略图、标题和音频图标的卡片链接
                seriesContentHtml += `
                    <div class="chapter-overview-item">
                        <a href="#${chapter.id}" class="overview-chapter-link" data-chapter-id="${chapter.id}" data-has-audio="${chapter.audio}" data-series-id="${chapter.seriesId}">
                            <img src="${chapter.thumbnail || 'images/placeholders/default_thumb.jpg'}" alt="${chapter.name}" class="chapter-thumbnail">
                            <div class="chapter-info">
                                <h3>${chapter.name} ${chapter.audio ? '🎵' : ''}</h3>
                                </div>
                        </a>
                    </div>
                `;
            });
        } else {
            seriesContentHtml += '<p>该系列暂无章节。</p>';
        }
        seriesContentHtml += '</div>';

        contentArea.innerHTML = seriesContentHtml; // 将生成的HTML放入内容区域

        // 对新生成的章节链接使用事件委托 💡
        // 只在 contentArea 上添加一个监听器
        contentArea.addEventListener('click', handleOverviewChapterLinkClick);
    });

    // 新增事件委托处理器 💡
    const handleOverviewChapterLinkClick = (event) => {
        let target = event.target;
        // 向上遍历DOM树，查找是否点击了 .overview-chapter-link 或其内部
        while (target && target !== contentArea) {
            if (target.classList.contains('overview-chapter-link')) {
                event.preventDefault(); // 阻止默认的链接跳转行为

                const chapterId = target.dataset.chapterId;
                const hasAudio = target.dataset.hasAudio === 'true';
                const seriesId = target.dataset.seriesId; // 获取 seriesId

                // 调用 Navigation 模块暴露的方法来加载单个章节的详细内容
                EnglishSite.Navigation.loadChapterContent(chapterId, hasAudio);
                
                // 更新浏览器URL，反映当前显示的是哪个章节
                history.pushState({ type: 'chapter', id: chapterId, seriesId: seriesId }, '', `#${chapterId}`);
                
                // 移除当前的事件监听器，避免重复绑定（因为每次 seriesSelected 都会重新绑定）
                contentArea.removeEventListener('click', handleOverviewChapterLinkClick);
                return; // 处理完毕，退出循环
            }
            target = target.parentNode;
        }
    };

    // --- 步骤 4: 监听 'chapterLoaded' 自定义事件 ---
    // 当 Navigation 模块发出章节加载完成事件时，处理音频和词汇表功能
    document.addEventListener('chapterLoaded', async (event) => {
        const { chapterId, hasAudio, error } = event.detail;
        console.log(`[main.js] 章节详情加载完成: ${chapterId}, 是否有音频: ${hasAudio}`);

        if (error) { // 如果 Navigation 模块在加载章节时报告错误
            EnglishSite.Glossary.cleanup();
            EnglishSite.AudioSync.cleanup();
            // 错误信息已由 Navigation 模块设置到 contentArea，这里不再重复处理
            return;
        }

        // 清理旧的模块状态（无论是从另一个章节还是从系列概览页切换过来）
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();

        // 初始化词汇表功能
        // Glossary.init 只需要 contentArea 和 chapterId，glossaryPopup 已经在 Glossary 内部获取
        EnglishSite.Glossary.init(contentArea, chapterId);

        // 获取并激活当前章节链接 (包括所属系列)
        // 假设 chapterLoaded 事件的 detail 包含 chapterId
        EnglishSite.Navigation.setActiveChapter(chapterId);


        // 音频播放器管理 ♻️
        // 始终确保有一个音频播放器元素存在，只控制其显示和 src
        if (!audioPlayer) {
            audioPlayer = document.createElement('audio');
            audioPlayer.id = 'chapter-audio';
            audioPlayer.controls = true;
            // 将播放器插入到 contentArea 的顶部，或特定容器
            // 如果您的HTML有固定音频控制容器，可以插入到那里
            contentArea.insertBefore(audioPlayer, contentArea.firstChild);
        }
        
        if (hasAudio) {
            const srtFilePath = `srt/${chapterId}.srt`;
            const audioFilePath = `audio/${chapterId}.mp3`;

            audioPlayer.style.display = 'block'; // 显示播放器
            audioPlayer.src = audioFilePath; // 设置音频源
            audioPlayer.load(); // 加载音频

            try {
                // 异步加载 SRT 字幕文件
                const srtResponse = await fetch(srtFilePath);
                if (!srtResponse.ok) throw new Error(`无法加载 SRT 文件: ${srtResponse.statusText}`);
                const srtText = await srtResponse.text();

                // 初始化音频同步功能
                EnglishSite.AudioSync.init(contentArea, srtText, audioPlayer);
            } catch (error) {
                console.error('[main.js] 加载或解析 SRT/音频失败:', error);
                // 在UI上显示音频/字幕加载错误信息
                const errorDiv = document.createElement('div');
                errorDiv.style.color = 'red';
                errorDiv.style.marginTop = '10px';
                errorDiv.textContent = '抱歉，音频或字幕加载失败，请检查文件。';
                contentArea.prepend(errorDiv);
            }
        } else {
            // 如果章节没有音频，隐藏播放器并清理AudioSync
            audioPlayer.style.display = 'none';
            EnglishSite.AudioSync.cleanup(); // 确保清理
        }
    });

    // --- 步骤 5: 移除：监听点击页面空白处隐藏词汇弹出框 ---
    // 这部分逻辑已完全移交至 Glossary.js 模块内部处理 🗑️
});
