// js/glossary.js

window.EnglishSite = window.EnglishSite || {};

EnglishSite.Glossary = (() => {
    let _glossaryTermsData = null; // 存储当前章节的词汇解释数据
    let _contentParent = null;     // 章节内容区域的 DOM 元素
    let _glossaryPopup = null;     // 词汇弹出框的 DOM 元素

    // 初始化词汇功能
    const init = async (contentParent, glossaryPopup, chapterId) => {
        _contentParent = contentParent;
        _glossaryPopup = glossaryPopup;

        const termsFilePath = `data/terms_${chapterId}.json`;

        try {
            const response = await fetch(termsFilePath);
            if (!response.ok) {
                console.warn(`[glossary.js] 未找到章节 '${chapterId}' 的词汇文件: ${termsFilePath}. 将使用空词汇表。`);
                _glossaryTermsData = {};
            } else {
                _glossaryTermsData = await response.json();
                console.log(`[glossary.js] 章节 '${chapterId}' 的词汇数据加载成功。`);
            }
        } catch (error) {
            console.error(`[glossary.js] 加载章节 '${chapterId}' 的词汇数据失败:`, error);
            _glossaryTermsData = {};
        }

        // 使用事件委托，将点击事件监听器附加到 contentParent
        // 移除旧的监听器以避免重复绑定
        _contentParent.removeEventListener('click', _handleGlossaryTermClickDelegated);
        _contentParent.addEventListener('click', _handleGlossaryTermClickDelegated);
    };

    // 清理函数：在章节切换时调用，移除事件监听器和数据
    const cleanup = () => {
        console.log("[glossary.js] Cleaning up previous glossary state.");
        if (_contentParent) {
            _contentParent.removeEventListener('click', _handleGlossaryTermClickDelegated);
        }
        if (_glossaryPopup) {
            _glossaryPopup.style.display = 'none'; // 隐藏任何打开的弹出框
        }
        _glossaryTermsData = null;
        _contentParent = null;
        _glossaryPopup = null;
    };

    // 委托事件处理函数 (私有函数)
    const _handleGlossaryTermClickDelegated = (event) => {
        const target = event.target;
        if (target.classList.contains('glossary-term') && _glossaryTermsData) {
            _handleGlossaryTermClick(target);
            event.stopPropagation();
        }
    };

    // 实际处理词汇点击的函数 (私有函数)
    const _handleGlossaryTermClick = (termElement) => {
        const wordId = termElement.dataset.word;
        const contextId = termElement.dataset.context || "default";

        const termData = _glossaryTermsData[wordId];

        if (!termData || !termData.definitions) {
            console.warn(`[glossary.js] 未找到单词 '${wordId}' 或其定义。`);
            _glossaryPopup.style.display = 'none';
            return;
        }

        let currentDefinition = termData.definitions[contextId];
        if (!currentDefinition && contextId !== "default") {
            console.warn(`[glossary.js] 未找到单词 '${wordId}' 的上下文 '${contextId}' 定义，尝试使用默认定义。`);
            currentDefinition = termData.definitions["default"];
        }

        if (!currentDefinition) {
            console.warn(`[glossary.js] 单词 '${wordId}' 既没有上下文 '${contextId}' 定义，也没有默认定义。`);
            _glossaryPopup.style.display = 'none';
            return;
        }

        let contentHtml = '';

        if (termData.title) {
            contentHtml += `<p><strong>${termData.title}</strong>`;
            if (termData.partOfSpeech) {
                contentHtml += ` <small>(${termData.partOfSpeech})</small>`;
            }
            contentHtml += '</p>';
        }

        if (termData.pronunciation) {
            contentHtml += `<p>音标: ${termData.pronunciation}</p>`;
        }

        contentHtml += `<hr style="margin: 10px 0;">`;
        contentHtml += `<h4>当前语境定义:</h4>`;

        if (currentDefinition.meaning) {
            contentHtml += `<p>${currentDefinition.meaning}</p>`;
        }
        if (currentDefinition.contextualMeaning) {
            contentHtml += `<p><strong>语境含义:</strong> ${currentDefinition.contextualMeaning}</p>`;
        }
        if (currentDefinition.exampleSentence) {
            contentHtml += `<p><strong>例句:</strong> <em>"${currentDefinition.exampleSentence}"</em></p>`;
        }
        if (currentDefinition.videoLink) {
            const videoIdMatch = currentDefinition.videoLink.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]+)/);
            if (videoIdMatch && videoIdMatch[1]) {
                const embedUrl = `https://www.youtube.com/embed/${videoIdMatch[1]}`; // 确保使用 HTTPS
                contentHtml += `<div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; margin-top: 10px;">
                                  <iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top:0; left: 0; width: 100%; height: 100%;"></iframe>
                                </div>`;
            } else {
                contentHtml += `<p><a href="${currentDefinition.videoLink}" target="_blank">观看相关视频</a> 🎥</p>`;
            }
        }
        if (currentDefinition.image) {
            contentHtml += `<p><img src="${currentDefinition.image}" alt="${termData.title || wordId} image" style="max-width:100%; height:auto; display:block; margin: 10px auto;"></p>`;
        }
        if (currentDefinition.synonyms && currentDefinition.synonyms.length > 0) {
            contentHtml += `<p><strong>同义词:</strong> ${currentDefinition.synonyms.join(', ')}</p>`;
        }
        if (currentDefinition.antonyms && currentDefinition.antonyms.length > 0) {
            contentHtml += `<p><strong>反义词:</strong> ${currentDefinition.antonyms.join(', ')}</p>`;
        }
        if (currentDefinition.etymology) {
            contentHtml += `<p><strong>词源:</strong> ${currentDefinition.etymology}</p>`;
        }
        if (currentDefinition.source) {
            contentHtml += `<p><small>来源: ${currentDefinition.source}</small></p>`;
        }
        if (currentDefinition.lastUpdated) {
            contentHtml += `<p><small>更新: ${currentDefinition.lastUpdated}</small></p>`;
        }
        if (currentDefinition.imagery) {
            contentHtml += `<p><em>Imagery:</em> ${currentDefinition.imagery}</p>`;
        }

        _glossaryPopup.innerHTML = contentHtml;

        // 定位弹出框
        const rect = termElement.getBoundingClientRect();
        const popupWidth = _glossaryPopup.offsetWidth;
        const popupHeight = _glossaryPopup.offsetHeight;

        let top = rect.top + window.scrollY - popupHeight - 10;
        let left = rect.left + window.scrollX + (rect.width / 2) - (popupWidth / 2);

        if (top < window.scrollY) {
            top = rect.bottom + window.scrollY + 10;
        }
        if (left < window.scrollX) {
            left = window.scrollX + 5;
        } else if (left + popupWidth > window.scrollX + window.innerWidth) {
            left = window.scrollX + window.innerWidth - popupWidth - 5;
        }

        _glossaryPopup.style.left = `${left}px`;
        _glossaryPopup.style.top = `${top}px`;
        _glossaryPopup.style.display = 'block';
    };

    return {
        init: init,
        cleanup: cleanup // 暴露清理接口
    };
})();

