// js/glossary.js (已修复缺陷的完整版本)

window.EnglishSite = window.EnglishSite || {};

EnglishSite.Glossary = (() => {
    let _contentArea = null;
    let _glossaryPopup = null;
    let _currentGlossaryData = {};
    let _cachedGlossaryData = new Map();
    let _popupClickStopPropagationHandler = null; 
    let _contentAreaClickHandler = null;
    let _activeTermElement = null; 
    let _debouncedResizeHandler = null; 

    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    };

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

        cleanup(); 

        if (_cachedGlossaryData.has(chapterId)) {
            _currentGlossaryData = _cachedGlossaryData.get(chapterId);
            console.log(`[Glossary] Loaded ${Object.keys(_currentGlossaryData).length} terms for chapter ${chapterId} from cache.`);
        } else {
            try {
                const response = await fetch(`data/terms_${chapterId}.json`);
                if (response.ok) {
                    _currentGlossaryData = await response.json();
                    _cachedGlossaryData.set(chapterId, _currentGlossaryData);
                    console.log(`[Glossary] Loaded ${Object.keys(_currentGlossaryData).length} terms for chapter ${chapterId} from network.`);
                } else {
                    console.warn(`[Glossary] No glossary data found for chapter "${chapterId}". Path: data/terms_${chapterId}.json`);
                    _currentGlossaryData = {}; 
                }
            } catch (e) {
                console.error('[Glossary] Failed to initialize:', e);
                _currentGlossaryData = {};
            }
        }

        _contentAreaClickHandler = (event) => {
            let target = event.target;
            while (target && target !== _contentArea) {
                if (target.classList.contains('glossary-term')) {
                    handleTermClick(event, target);
                    return;
                }
                target = target.parentNode;
            }
        };
        _contentArea.addEventListener('click', _contentAreaClickHandler);

        document.addEventListener('click', handleDocumentClick);

        _popupClickStopPropagationHandler = e => e.stopPropagation();
        _glossaryPopup.addEventListener('click', _popupClickStopPropagationHandler);

        const closeBtn = _glossaryPopup.querySelector('.close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', hidePopup);
        }

        _debouncedResizeHandler = debounce(handleResize, 150);
        window.addEventListener('resize', _debouncedResizeHandler);
    };
    
    const handleResize = () => {
        if (_glossaryPopup && _glossaryPopup.style.display === 'block' && _activeTermElement) {
            positionPopup(_activeTermElement);
        }
    };
    
    const cleanup = () => {
        if (_contentArea && _contentAreaClickHandler) {
            _contentArea.removeEventListener('click', _contentAreaClickHandler);
            _contentAreaClickHandler = null;
        }
        document.removeEventListener('click', handleDocumentClick);
        
        // 【已修正】将 closeBtn 的逻辑移入到这个安全检查块内，防止 _glossaryPopup 为 null 时出错
        if (_glossaryPopup) {
             if (_popupClickStopPropagationHandler) {
                 _glossaryPopup.removeEventListener('click', _popupClickStopPropagationHandler);
                 _popupClickStopPropagationHandler = null;
            }
            const closeBtn = _glossaryPopup.querySelector('.close-button');
            if (closeBtn) {
                closeBtn.removeEventListener('click', hidePopup);
            }
        }

        if (_debouncedResizeHandler) {
            window.removeEventListener('resize', _debouncedResizeHandler);
            _debouncedResizeHandler = null;
        }
        
        hidePopup();
        _currentGlossaryData = {};
        console.log('[Glossary] Cleaned up.');
    };

    const hidePopup = () => {
        if (_glossaryPopup) _glossaryPopup.style.display = 'none';
        _activeTermElement = null;
    };

    const handleDocumentClick = (event) => {
        if (_glossaryPopup &&
            _glossaryPopup.style.display === 'block' &&
            !_glossaryPopup.contains(event.target) &&
            !event.target.classList.contains('glossary-term')
        ) {
            hidePopup();
        }
    };

    const handleTermClick = (event, termElement) => {
        event.stopPropagation();
        const word = termElement.dataset.word;
        const context = termElement.dataset.context;
        if (!word || !_currentGlossaryData[word]) return hidePopup();

        const termData = _currentGlossaryData[word];
        let displayEntry = termData.contexts?.[context]?.[0] || termData.contexts?.["default"]?.[0];
        if (!displayEntry) return hidePopup();
        
        _glossaryPopup.querySelector('#glossary-word').textContent = displayEntry.title || word;
        _glossaryPopup.querySelector('.glossary-pronunciation').textContent = displayEntry.pronunciation || '';

        let html = '<div class="glossary-definition-block">';
        if (displayEntry.partOfSpeech) html += `<p class="glossary-part-of-speech">(${displayEntry.partOfSpeech})</p>`;
        html += `<p class="glossary-main-definition">${displayEntry.definition || 'Definition not available.'}</p>`;
        if (displayEntry.exampleSentence) {
            const highlighted = displayEntry.exampleSentence.replace(new RegExp(`\\b${word}\\b`, 'gi'), `<strong>$&</strong>`);
            html += `<p class="glossary-example"><strong>Example:</strong> ${highlighted}</p>`;
        }
        if (displayEntry.image) {
            html += `<img src="${displayEntry.image}" alt="${displayEntry.imageDescription || word}" class="glossary-image">`;
            if (displayEntry.imageDescription) html += `<p class="glossary-image-description">${displayEntry.imageDescription}</p>`;
        }
        if (displayEntry.videoLink) html += `<p class="glossary-video-link"><a href="${displayEntry.videoLink}" target="_blank">Watch Video 🎬</a></p>`;
        if (displayEntry.synonyms?.length) html += `<p class="glossary-synonyms"><strong>Synonyms:</strong> ${displayEntry.synonyms.join(', ')}</p>`;
        if (displayEntry.antonyms?.length) html += `<p class="glossary-antonyms"><strong>Antonyms:</strong> ${displayEntry.antonyms.join(', ')}</p>`;
        if (displayEntry.etymology) html += `<p class="glossary-etymology"><strong>Etymology:</strong> ${displayEntry.etymology}</p>`;
        if (displayEntry.category) html += `<p class="glossary-category"><strong>Category:</strong> ${displayEntry.category}</p>`;
        if (displayEntry.source) html += `<p class="glossary-source"><strong>Source:</strong> ${displayEntry.source}</p>`;
        if (displayEntry.notes) html += `<p class="glossary-notes"><strong>Note:</strong> ${displayEntry.notes}</p>`;
        if (displayEntry.level) html += `<p class="glossary-level"><strong>Level:</strong> ${displayEntry.level}</p>`;
        if (displayEntry.frequency !== undefined) html += `<p class="glossary-frequency"><strong>Frequency:</strong> COCA ${displayEntry.frequency}</p>`;
        if (displayEntry.lastUpdated) html += `<p class="glossary-last-updated"><strong>Last Updated:</strong> ${displayEntry.lastUpdated}</p>`;
        if (displayEntry.rootsAndAffixes) html += `<p class="glossary-roots"><strong>Roots & Affixes:</strong> ${displayEntry.rootsAndAffixes}</p>`;
        html += `</div>`;
        
        _glossaryPopup.querySelector('#glossary-definition').innerHTML = html;
        
        _activeTermElement = termElement;
        positionPopup(termElement);
        _glossaryPopup.style.display = 'block';
    };

    const positionPopup = (termElement) => {
        const rect = termElement.getBoundingClientRect();
        const popupWidth = _glossaryPopup.offsetWidth;
        const popupHeight = _glossaryPopup.offsetHeight;

        let left = rect.left + window.scrollX + (rect.width / 2) - (popupWidth / 2);
        let top = rect.bottom + window.scrollY + 5;

        const viewportRight = window.innerWidth + window.scrollX;
        if (left + popupWidth > viewportRight - 10) left = viewportRight - popupWidth - 10;
        if (left < 10) left = 10;

        const viewportBottom = window.innerHeight + window.scrollY;
        if (top + popupHeight > viewportBottom - 10) top = rect.top + window.scrollY - popupHeight - 5;
        if (top < window.scrollY + 10) top = window.scrollY + 10;

        _glossaryPopup.style.left = `${left}px`;
        _glossaryPopup.style.top = `${top}px`;
    };

    return { init, cleanup };
})();
