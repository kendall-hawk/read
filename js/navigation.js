// js/navigation.js

// 创建一个全局命名空间对象，避免污染全局作用域
window.EnglishSite = window.EnglishSite || {};

EnglishSite.Navigation = (() => {
    let _navContainer = null;
    let _contentArea = null;
    let _navData = [];

    // 初始化导航功能
    const init = (navContainer, contentArea, navData) => {
        _navContainer = navContainer;
        _contentArea = contentArea;
        _navData = navData;

        renderNavigation();
        handleInitialLoadAndPopstate();
    };

    // 渲染导航菜单
    const renderNavigation = () => {
        const navList = document.createElement('ul');

        _navData.forEach(series => {
            const seriesHeader = document.createElement('li');
            seriesHeader.innerHTML = `<strong>${series.series}</strong>`;
            navList.appendChild(seriesHeader);

            series.chapters.forEach(chapter => {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = `#${chapter.id}`;
                link.textContent = chapter.name;
                link.dataset.chapterId = chapter.id;
                link.dataset.hasAudio = chapter.audio;

                if (chapter.audio) {
                    link.innerHTML += ' 🎵';
                }

                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    setActiveLink(link);
                    loadChapterContent(chapter.id, chapter.audio);
                });
                listItem.appendChild(link);
                navList.appendChild(listItem);
            });
        });
        _navContainer.appendChild(navList);
    };

    // 设置激活的导航链接
    const setActiveLink = (linkElement) => {
        _navContainer.querySelectorAll('a.active').forEach(a => a.classList.remove('active'));
        if (linkElement) {
            linkElement.classList.add('active');
        }
    };

    // 核心函数：加载章节内容到主显示区域
    const loadChapterContent = async (chapterId, hasAudio) => {
        const chapterFilePath = `chapters/${chapterId}.html`;

        try {
            const response = await fetch(chapterFilePath);
            if (!response.ok) {
                throw new Error(`HTTP 错误! 状态: ${response.status}`);
            }
            const chapterHtml = await response.text();

            _contentArea.innerHTML = chapterHtml;

            // 更新浏览器URL
            history.pushState({ chapterId: chapterId }, '', `#${chapterId}`);

            // 触发 'chapterLoaded' 自定义事件，通知其他模块章节已加载完成
            document.dispatchEvent(new CustomEvent('chapterLoaded', {
                detail: { chapterId: chapterId, hasAudio: hasAudio }
            }));

        } catch (error) {
            console.error('[navigation.js] 加载章节失败:', error);
            _contentArea.innerHTML = `<p style="color: red;">抱歉，章节内容加载失败。请检查文件或网络连接。</p>`;
            // 即使加载失败，也触发事件，通知其他模块进行清理
            document.dispatchEvent(new CustomEvent('chapterLoaded', {
                detail: { chapterId: chapterId, hasAudio: false }
            }));
        }
    };

    // 处理初始加载和浏览器前进/后退
    const handleInitialLoadAndPopstate = () => {
        const allChapters = _navData.flatMap(s => s.chapters);
        const initialChapterId = window.location.hash ? window.location.hash.substring(1) : allChapters[0]?.id;
        const initialChapter = allChapters.find(c => c.id === initialChapterId) || allChapters[0]; // 确保总有一个默认章节

        if (initialChapter) {
            loadChapterContent(initialChapter.id, initialChapter.audio);
            const activeLink = _navContainer.querySelector(`a[data-chapter-id="${initialChapter.id}"]`);
            setActiveLink(activeLink);
        }

        window.addEventListener('popstate', (event) => {
            const chapterId = event.state?.chapterId || allChapters[0]?.id;
            const chapterInfo = allChapters.find(c => c.id === chapterId) || allChapters[0];

            if (chapterInfo) {
                loadChapterContent(chapterInfo.id, chapterInfo.audio);
                const activeLink = _navContainer.querySelector(`a[data-chapter-id="${chapterInfo.id}"]`);
                setActiveLink(activeLink);
            }
        });
    };

    return {
        init: init
    };
})();

