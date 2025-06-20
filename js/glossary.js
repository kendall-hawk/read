window.EnglishSite = window.EnglishSite || {};

EnglishSite.Glossary = (() => {
    let _contentArea = null;
    let _glossaryPopup = null;
    let _currentGlossaryData = {};

    /**
     * 初始化词汇表模块。
     * 加载当前章节的词汇数据，并为所有带有 'glossary-term' 类的元素添加点击事件监听器。
     * @param {HTMLElement} contentArea - 包含章节文本的DOM区域。
     * @param {string} chapterId - 当前章节的ID (例如 'chap1')，用于构建词汇JSON文件路径。
     */
    const init = async (contentArea, chapterId) => {
        if (!contentArea || !chapterId) {
            console.error('[Glossary] Missing contentArea or chapterId.');
            return;
        }

        _contentArea = contentArea;
        _glossaryPopup = document.getElementById('glossary-popup');
        if (!_glossaryPopup) {
            console.error('[Glossary] Glossary popup not found.');
            return;
        }

        // 每次初始化前清理，确保新的章节加载时是干净的状态
        cleanup(); 

        try {
            const response = await fetch(`data/terms_${chapterId}.json`);
            if (response.ok) {
                _currentGlossaryData = await response.json();
                console.log(`[Glossary] Loaded ${Object.keys(_currentGlossaryData).length} terms for chapter ${chapterId}.`);
            } else {
                console.warn(`[Glossary] No glossary data found for chapter "${chapterId}". Path: data/terms_${chapterId}.json`);
                _currentGlossaryData = {}; // 没有找到数据，清空当前词汇数据
            }

            // 为所有带有 glossary-term 类的元素添加点击监听器
            _contentArea.querySelectorAll('.glossary-term').forEach(el =>
                el.addEventListener('click', handleTermClick)
            );

            // 添加全局点击事件以关闭弹出框
            document.addEventListener('click', handleDocumentClick);
            // 阻止弹出框内部点击事件冒泡，防止点击弹出框时关闭
            _glossaryPopup.addEventListener('click', e => e.stopPropagation());

            // 关闭按钮事件监听器
            const closeBtn = _glossaryPopup.querySelector('.close-button');
            if (closeBtn) {
                closeBtn.addEventListener('click', hidePopup);
            }
        } catch (e) {
            console.error('[Glossary] Failed to initialize:', e);
            _currentGlossaryData = {}; // 出现错误时清空数据
        }
    };

    /**
     * 清理词汇表模块，移除事件监听器并隐藏弹出框。
     */
    const cleanup = () => {
        if (_contentArea) {
            // 移除所有词汇元素的点击监听器
            _contentArea.querySelectorAll('.glossary-term').forEach(el =>
                el.removeEventListener('click', handleTermClick)
            );
        }
        // 移除文档级的点击监听器
        document.removeEventListener('click', handleDocumentClick);
        // 移除弹出框内部的点击冒泡阻止
        if (_glossaryPopup) {
             _glossaryPopup.removeEventListener('click', e => e.stopPropagation());
            // 移除关闭按钮的点击监听器
            const closeBtn = _glossaryPopup.querySelector('.close-button');
            if (closeBtn) {
                closeBtn.removeEventListener('click', hidePopup);
            }
        }
        hidePopup(); // 隐藏当前的弹出框
        _currentGlossaryData = {}; // 清空当前章节的词汇数据
        console.log('[Glossary] Cleaned up.');
    };

    /**
     * 隐藏词汇表弹出框。
     */
    const hidePopup = () => {
        if (_glossaryPopup) _glossaryPopup.style.display = 'none';
    };

    /**
     * 处理文档点击事件，如果点击在弹出框外部则隐藏弹出框。
     * @param {Event} event - 点击事件对象。
     */
    const handleDocumentClick = (event) => {
        // 只有当弹出框显示中，且点击目标不是弹出框本身，也不是触发弹出框的词汇元素时，才隐藏。
        if (_glossaryPopup &&
            _glossaryPopup.style.display === 'block' &&
            !_glossaryPopup.contains(event.target) &&
            !event.target.classList.contains('glossary-term')
        ) {
            hidePopup();
        }
    };

    /**
     * 处理词汇点击事件，显示词汇表弹出框。
     * @param {Event} event - 点击事件对象。
     */
    const handleTermClick = (event) => {
        event.stopPropagation(); // 阻止事件冒泡到 document，避免立即关闭弹出框

        const termElement = event.currentTarget;
        const word = termElement.dataset.word; // 从HTML获取单词 (例如 'run')
        const context = termElement.dataset.context; // 从HTML获取语境 (例如 'sport', 'technology', 'default')

        // 检查单词是否存在于当前章节词汇数据中
        if (!word || !_currentGlossaryData[word]) {
            console.warn(`[Glossary] Word "${word}" not found in current chapter's glossary data.`);
            hidePopup();
            return;
        }

        const termData = _currentGlossaryData[word]; // 获取该单词的整体数据
        let displayEntry = null; // 存储最终要显示的释义对象

        // 1. 尝试根据 context 获取释义
        // 假设每个 context 下的数组中只包含一个释义对象
        if (context && termData.contexts && termData.contexts[context] && termData.contexts[context].length > 0) {
            displayEntry = termData.contexts[context][0];
            console.log(`[Glossary] Found specific definition for "${word}" in context "${context}".`);
        } else if (termData.contexts && termData.contexts["default"] && termData.contexts["default"].length > 0) {
            // 2. 如果特定 context 不存在或为空，则回退到 "default" context
            displayEntry = termData.contexts["default"][0];
            console.log(`[Glossary] Using default definition for "${word}".`);
        }

        // 3. 如果最终没有找到任何释义，则隐藏弹出框并报错
        if (!displayEntry) {
            console.warn(`[Glossary] No suitable definition found for "${word}" in context "${context}" or default.`);
            hidePopup();
            return;
        }

        // --- 填充弹出框的头部信息 ---
        // 使用释义对象中的 title，如果不存在则使用原始单词
        _glossaryPopup.querySelector('#glossary-word').textContent = displayEntry.title || word;
        // 使用释义对象中的发音
        _glossaryPopup.querySelector('.glossary-pronunciation').textContent = displayEntry.pronunciation || '';

        let html = ''; // 用于构建弹出框内容的HTML字符串

        // --- 渲染所有字段，直接从 displayEntry 对象中获取 ---
        // 使用 `displayEntry` 而不是 `entry`，因为现在只处理一个释义
        html += `<div class="glossary-definition-block">`; // 包裹每个释义的容器

        if (displayEntry.partOfSpeech) {
            html += `<p class="glossary-part-of-speech">(${displayEntry.partOfSpeech})</p>`;
        }

        html += `<p class="glossary-main-definition">${displayEntry.definition || 'Definition not available.'}</p>`;

        if (displayEntry.exampleSentence) {
            // 高亮例句中的单词，不区分大小写，只匹配完整单词
            const highlighted = displayEntry.exampleSentence.replace(
                new RegExp(`\\b${word}\\b`, 'gi'), // 使用原始的 'word' 进行高亮
                `<strong>$&</strong>`
            );
            html += `<p class="glossary-example"><strong>Example:</strong> ${highlighted}</p>`;
        }

        if (displayEntry.image) {
            html += `<img src="${displayEntry.image}" alt="${displayEntry.imageDescription || word}" class="glossary-image">`;
            if (displayEntry.imageDescription) {
                html += `<p class="glossary-image-description">${displayEntry.imageDescription}</p>`;
            }
        }

        if (displayEntry.videoLink) {
            html += `<p class="glossary-video-link"><a href="${displayEntry.videoLink}" target="_blank">Watch Video 🎬</a></p>`;
        }

        if (displayEntry.synonyms?.length) { // 使用可选链操作符?.简化非空检查
            html += `<p class="glossary-synonyms"><strong>Synonyms:</strong> ${displayEntry.synonyms.join(', ')}</p>`;
        }

        if (displayEntry.antonyms?.length) {
            html += `<p class="glossary-antonyms"><strong>Antonyms:</strong> ${displayEntry.antonyms.join(', ')}</p>`;
        }

        if (displayEntry.etymology) {
            html += `<p class="glossary-etymology"><strong>Etymology:</strong> ${displayEntry.etymology}</p>`;
        }

        if (displayEntry.category) {
            html += `<p class="glossary-category"><strong>Category:</strong> ${displayEntry.category}</p>`;
        }

        if (displayEntry.source) {
            html += `<p class="glossary-source"><strong>Source:</strong> ${displayEntry.source}</p>`;
        }

        if (displayEntry.notes) {
            html += `<p class="glossary-notes"><strong>Note:</strong> ${displayEntry.notes}</p>`;
        }

        if (displayEntry.level) {
            html += `<p class="glossary-level"><strong>Level:</strong> ${displayEntry.level}</p>`;
        }

        if (displayEntry.frequency !== undefined) { // frequency 可能是 0，所以不能用truthy check
            html += `<p class="glossary-frequency"><strong>Frequency:</strong> ${displayEntry.frequency}</p>`;
        }

        if (displayEntry.lastUpdated) {
            html += `<p class="glossary-last-updated"><strong>Last Updated:</strong> ${displayEntry.lastUpdated}</p>`;
        }

        html += `</div>`; // 关闭释义块

        // 将构建好的HTML插入到弹出框内容区域
        _glossaryPopup.querySelector('#glossary-definition').innerHTML = html;
        positionPopup(termElement); // 定位弹出框
        _glossaryPopup.style.display = 'block'; // 显示弹出框
    };

    /**
     * 定位词汇表弹出框，使其显示在点击的词汇附近。
     * @param {HTMLElement} termElement - 被点击的词汇DOM元素。
     */
    const positionPopup = (termElement) => {
        const rect = termElement.getBoundingClientRect(); // 获取点击元素相对于视口的尺寸和位置
        const popupWidth = _glossaryPopup.offsetWidth;   // 弹出框的宽度
        const popupHeight = _glossaryPopup.offsetHeight; // 弹出框的高度

        let top = rect.bottom + window.scrollY + 5; // 默认：弹出框顶部在点击元素底部下方5px
        let left = rect.left + window.scrollX;      // 默认：弹出框左边与点击元素左边对齐

        // 边界检查：确保弹出框不会超出视口右边界
        if (left + popupWidth > window.innerWidth + window.scrollX) {
            left = window.innerWidth + window.scrollX - popupWidth - 10; // 调整到右侧，留10px边距
            // 如果调整后仍然超出左边界（页面太窄），则靠左边显示
            if (left < window.scrollX) {
                 left = window.scrollX + 10;
            }
        }

        // 边界检查：确保弹出框不会超出视口左边界
        if (left < window.scrollX) {
            left = window.scrollX + 10; // 调整到左侧，留10px边距
        }

        // 边界检查：确保弹出框不会超出视口下边界
        if (top + popupHeight > window.innerHeight + window.scrollY) {
            top = rect.top + window.scrollY - popupHeight - 5; // 如果下方空间不够，则显示在点击元素上方5px
            // 如果上方空间也不够（元素在页面顶部），则靠顶部显示
            if (top < window.scrollY) {
                top = window.scrollY + 10;
            }
        }

        // 设置弹出框的最终位置
        _glossaryPopup.style.left = `${left}px`;
        _glossaryPopup.style.top = `${top}px`;
    };

    // 返回公共接口，供外部调用
    return { init, cleanup };
})();
