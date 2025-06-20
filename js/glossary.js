// js/glossary.js

window.EnglishSite = window.EnglishSite || {};

EnglishSite.Glossary = (() => {
    let _contentArea = null;
    let _glossaryPopup = null;
    let _glossaryData = {}; // 存储当前章节的词汇数据
    let _activeChapterId = null; // 记录当前章节ID

    // 初始化词汇表功能
    const init = async (contentArea, glossaryPopup, chapterId) => {
        cleanup(); // 先清理旧的状态

        _contentArea = contentArea;
        _glossaryPopup = glossaryPopup;
        _activeChapterId = chapterId;

        // 加载当前章节的词汇数据
        await loadGlossaryData(chapterId);

        // 为所有词汇表术语添加点击监听器
        const terms = _contentArea.querySelectorAll('.glossary-term');
        terms.forEach(term => {
            term.addEventListener('click', handleTermClick);
        });

        // 词汇弹出框的关闭按钮
        const closeBtn = _glossaryPopup.querySelector('#close-glossary-popup');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                _glossaryPopup.style.display = 'none';
            });
        }

        console.log(`[Glossary] 初始化成功。章节ID: ${chapterId}, 词汇数据:`, _glossaryData);
    };

    // 加载章节词汇数据
    const loadGlossaryData = async (chapterId) => {
        const termsFilePath = `data/terms_${chapterId}.json`;
        try {
            const response = await fetch(termsFilePath);
            if (!response.ok) {
                // 如果文件不存在，可能是该章节没有词汇表，不报错
                if (response.status === 404) {
                    console.warn(`[Glossary] 未找到章节 ${chapterId} 的词汇数据: ${termsFilePath}`);
                    _glossaryData = {}; // 清空数据
                } else {
                    throw new Error(`加载词汇数据失败: ${response.statusText} (${response.status})`);
                }
            } else {
                _glossaryData = await response.json();
            }
        } catch (error) {
            console.error('[Glossary] 加载词汇数据时出错:', error);
            _glossaryData = {}; // 确保清空数据
        }
    };

    // 处理词汇点击事件
    const handleTermClick = (event) => {
        event.stopPropagation(); // 阻止事件冒泡到document，避免立即关闭弹出框

        const termElement = event.currentTarget;
        const word = termElement.dataset.word;
        const context = termElement.dataset.context; // 获取上下文

        if (word && _glossaryData[word]) {
            const termData = _glossaryData[word]; // Get all data for the term

            // Select definition based on context, or fall back to default
            let currentDefinition = termData.definition;
            if (context && termData.contextualMeaning && termData.contextualMeaning.hasOwnProperty(context)) {
                // Modified: Using contextualMeaning as an object with context keys
                currentDefinition = termData.contextualMeaning[context];
            } else if (termData.definition) {
                currentDefinition = termData.definition;
            } else {
                currentDefinition = "Definition not available.";
            }

            // Update popup header
            _glossaryPopup.querySelector('#glossary-word').textContent = termData.title || word; // Use title if available, otherwise fallback to word

            // Build the HTML content for the popup body
            let definitionHtml = '';

            // Part of Speech
            if (termData.partOfSpeech) {
                definitionHtml += `<p class="glossary-part-of-speech">(${termData.partOfSpeech})</p>`;
            }
            
            // Pronunciation
            if (termData.pronunciation) {
                definitionHtml += `<p class="glossary-pronunciation">${termData.pronunciation}</p>`;
            }

            // Main Definition (always display, as it's the core)
            definitionHtml += `<p class="glossary-main-definition">${currentDefinition}</p>`;

            // Example Sentence
            if (termData.exampleSentence) {
                // Bold the word in the example sentence
                // Ensure the word is replaced case-insensitively and only whole words
                const highlightedExample = termData.exampleSentence.replace(new RegExp(`\\b${word}\\b`, 'gi'), `<strong>$&</strong>`);
                definitionHtml += `<p class="glossary-example"><strong>Example:</strong> ${highlightedExample}</p>`;
            }

            // Image
            if (termData.image) {
                definitionHtml += `<img src="${termData.image}" alt="${termData.imageDescription || word}" class="glossary-image">`;
                if (termData.imageDescription) {
                    definitionHtml += `<p class="glossary-image-description">${termData.imageDescription}</p>`;
                }
            }

            // Video Link
            if (termData.videoLink) {
                definitionHtml += `<p class="glossary-video-link"><a href="${termData.videoLink}" target="_blank">Watch Video 🎬</a></p>`;
            }

            // Synonyms
            if (termData.synonyms && termData.synonyms.length > 0 && termData.synonyms[0] !== "") { // Check for non-empty array with non-empty string
                definitionHtml += `<p class="glossary-synonyms"><strong>Synonyms:</strong> ${termData.synonyms.join(', ')}</p>`;
            }

            // Antonyms
            if (termData.antonyms && termData.antonyms.length > 0 && termData.antonyms[0] !== "") { // Check for non-empty array with non-empty string
                definitionHtml += `<p class="glossary-antonyms"><strong>Antonyms:</strong> ${termData.antonyms.join(', ')}</p>`;
            }

            // Etymology
            if (termData.etymology) {
                definitionHtml += `<p class="glossary-etymology"><strong>Etymology:</strong> ${termData.etymology}</p>`;
            }

            // Category
            if (termData.category) {
                definitionHtml += `<p class="glossary-category"><strong>Category:</strong> ${termData.category}</p>`;
            }

            // Source
            if (termData.source) {
                definitionHtml += `<p class="glossary-source"><strong>Source:</strong> ${termData.source}</p>`;
            }

            // Last Updated
            if (termData.lastUpdated) {
                definitionHtml += `<p class="glossary-last-updated"><strong>Last Updated:</strong> ${termData.lastUpdated}</p>`;
            }

            _glossaryPopup.querySelector('#glossary-definition').innerHTML = definitionHtml;

            // Position and display the popup
            positionPopup(termElement);
            _glossaryPopup.style.display = 'block';
        } else {
            console.warn(`[Glossary] No definition found for word "${word}".`);
            _glossaryPopup.style.display = 'none'; // Hide popup
        }
    };

    // 定位弹出框
    const positionPopup = (targetElement) => {
        const rect = targetElement.getBoundingClientRect();
        _glossaryPopup.style.visibility = 'hidden'; // Hide temporarily to get accurate dimensions
        _glossaryPopup.style.display = 'block'; // Make it block to calculate dimensions

        const popupWidth = _glossaryPopup.offsetWidth;
        const popupHeight = _glossaryPopup.offsetHeight;

        _glossaryPopup.style.visibility = 'visible'; // Show it again

        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        let left = rect.left + window.scrollX;
        let top = rect.bottom + window.scrollY + 10; // 弹出在下方，留10px间距

        // 如果弹出框超出右边界
        if (left + popupWidth > viewportWidth + window.scrollX - 20) {
            left = viewportWidth + window.scrollX - popupWidth - 20;
        }
        // 如果弹出框超出左边界
        if (left < window.scrollX + 10) {
            left = window.scrollX + 10;
        }

        // 如果弹出框超出下边界，则向上显示
        if (top + popupHeight > viewportHeight + window.scrollY - 20) {
            top = rect.top + window.scrollY - popupHeight - 10; // 弹出在上方
            // 如果向上显示也超出上边界，则固定在顶部
            if (top < window.scrollY + 10) {
                top = window.scrollY + 10;
            }
        }

        _glossaryPopup.style.left = `${left}px`;
        _glossaryPopup.style.top = `${top}px`;
    };

    // 清理函数：移除事件监听器和数据
    const cleanup = () => {
        if (_contentArea) {
            const terms = _contentArea.querySelectorAll('.glossary-term');
            terms.forEach(term => {
                term.removeEventListener('click', handleTermClick);
            });
        }
        // 隐藏弹出框
        if (_glossaryPopup) {
            _glossaryPopup.style.display = 'none';
        }
        // 清理数据
        _glossaryData = {};
        _activeChapterId = null;
        _contentArea = null;
        _glossaryPopup = null;
        console.log('[Glossary] 已清理。');
    };

    return {
        init: init,
        cleanup: cleanup
    };
})();
