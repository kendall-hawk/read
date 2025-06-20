// js/audio-sync.js

window.EnglishSite = window.EnglishSite || {};

EnglishSite.AudioSync = (() => {
    let _audioPlayer = null;
    let _currentHighlightedElement = null;
    let _currentSrtSegments = null;
    let _currentTextElementsMap = new Map();
    let _contentParent = null; // 章节内容区域的 DOM 元素

    let _loopSegmentActive = false;
    let _currentLoopSegment = null; // 存储当前循环的句段信息 {id, start, end}

    // 清理函数
    const cleanup = () => {
        console.log("[audio-sync.js] Cleaning up previous audio sync state.");

        if (_audioPlayer) {
            _audioPlayer.removeEventListener('timeupdate', _handleTimeUpdate);
            _audioPlayer.removeEventListener('ended', _handleAudioEnded);
            _audioPlayer.pause();
            _audioPlayer.currentTime = 0;
        }
        if (_contentParent) {
            _contentParent.removeEventListener('click', _handleTextClickToSeekDelegated);
            // 确保移除所有可能残留的高亮
            _contentParent.querySelectorAll('.highlighted').forEach(el => {
                el.classList.remove('highlighted');
            });
        }
        if (_currentHighlightedElement) {
            _currentHighlightedElement.classList.remove('highlighted');
            _currentHighlightedElement = null;
        }

        _loopSegmentActive = false;
        _currentLoopSegment = null;

        _currentSrtSegments = null;
        _currentTextElementsMap.clear();
        _audioPlayer = null;
        _contentParent = null;

        // 移除速度控制和循环播放按钮（如果存在）
        const speedControlDiv = document.getElementById('audio-controls');
        if (speedControlDiv) {
            speedControlDiv.remove();
        }
    };

    // 初始化音频同步功能
    const init = (contentParent, srtText, audioPlayer) => {
        cleanup(); // 确保在初始化新章节前清理旧的状态

        _contentParent = contentParent;
        _audioPlayer = audioPlayer;

        if (!_audioPlayer) {
            console.log("[audio-sync.js] 未传入音频播放器。音频同步未初始化。");
            return;
        }

        _currentSrtSegments = _parseSrt(srtText);

        if (!_currentSrtSegments || _currentSrtSegments.length === 0) {
            console.warn(`[audio-sync.js] 未解析到有效的 SRT 片段。音频同步将无法工作。`);
            return;
        }

        const chapterArticleContent = _contentParent.querySelector('#chapter-article-content');
        if (!chapterArticleContent) {
            console.error("[audio-sync.js] 未找到 '#chapter-article-content' div，无法进行音频同步映射。");
            cleanup();
            return;
        }

        _currentTextElementsMap.clear();
        chapterArticleContent.querySelectorAll('[id]').forEach(element => {
            if (element.id) {
                _currentTextElementsMap.set(element.id, element);
            }
        });

        _currentSrtSegments.forEach(segment => {
            if (segment.id && !_currentTextElementsMap.has(segment.id)) {
                console.warn(`[audio-sync.js] SRT 字幕引用了 ID '${segment.id}'，但在 HTML 章节中未找到对应元素。该片段将无法高亮。`);
            }
        });

        _audioPlayer.addEventListener('timeupdate', _handleTimeUpdate);
        _audioPlayer.addEventListener('ended', _handleAudioEnded);

        _contentParent.addEventListener('click', _handleTextClickToSeekDelegated);

        _addAudioControls(_audioPlayer);

        console.log("[audio-sync.js] Audio sync initialized successfully.");
    };

    // --- 私有辅助函数 ---

    // SRT 解析函数
    const _parseSrt = (srtText) => {
        const lines = srtText.split(/\r?\n/);
        const segments = [];
        let i = 0;

        function parseTime(timeStr) {
            const parts = timeStr.split(',');
            const [h, m, s] = parts[0].split(':').map(Number);
            const ms = Number(parts[1]);
            return h * 3600 + m * 60 + s + ms / 1000;
        }

        while (i < lines.length) {
            if (lines[i].trim() === '') {
                i++;
                continue;
            }
            const segmentNumber = lines[i].trim();
            if (!/^\d+$/.test(segmentNumber)) {
                i++;
                continue;
            }
            i++;

            if (i < lines.length && lines[i].includes('-->')) {
                const [startTimeStr, endTimeStr] = lines[i].split('-->').map(s => s.trim());
                const start = parseTime(startTimeStr);
                const end = parseTime(endTimeStr);
                i++;

                let textContent = '';
                let segmentId = null;

                while (i < lines.length && lines[i].trim() !== '') {
                    const line = lines[i].trim();
                    const idMatch = line.match(/^<id=([^>]+)>/);

                    if (idMatch) {
                        segmentId = idMatch[1];
                        textContent += line.substring(idMatch[0].length).trim();
                    } else {
                        textContent += line;
                    }
                    const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
                    if (nextLine !== '' && !/^\d+$/.test(nextLine) && !nextLine.includes('-->') && !nextLine.match(/^<id=([^>]+)>/)) {
                        textContent += ' ';
                    }
                    i++;
                }
                segments.push({
                    id: segmentId,
                    text: textContent.trim(),
                    start: start,
                    end: end
                });
            }
        }
        return segments;
    };

    // -----------------------------------------------------------
    // 私有事件处理函数
    // -----------------------------------------------------------

    const _handleTimeUpdate = () => {
        const currentTime = _audioPlayer.currentTime;

        let foundSegment = null;
        for (const segment of _currentSrtSegments) {
            if (currentTime >= segment.start && currentTime < segment.end + 0.1) {
                foundSegment = segment;
                break;
            }
        }

        if (foundSegment && foundSegment.id) {
            const elementToHighlight = _currentTextElementsMap.get(foundSegment.id);

            if (elementToHighlight && elementToHighlight !== _currentHighlightedElement) {
                if (_currentHighlightedElement) {
                    _currentHighlightedElement.classList.remove('highlighted');
                }
                elementToHighlight.classList.add('highlighted');
                _currentHighlightedElement = elementToHighlight;

                if (!_isElementInViewport(elementToHighlight)) {
                    elementToHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        } else if (_currentHighlightedElement) {
            _currentHighlightedElement.classList.remove('highlighted');
            _currentHighlightedElement = null;
        }
    };

    const _handleAudioEnded = () => {
        console.log("[audio-sync.js] Audio ended.");
        if (_currentHighlightedElement) {
            _currentHighlightedElement.classList.remove('highlighted');
            _currentHighlightedElement = null;
        }
        if (_loopSegmentActive && _currentLoopSegment && _audioPlayer) {
            console.log("[audio-sync.js] Looping current segment.");
            _audioPlayer.currentTime = _currentLoopSegment.start;
            _audioPlayer.play();
        } else {
            _toggleLoopSegment(false); // 播放结束，确保循环停止
        }
    };

    const _handleTextClickToSeekDelegated = (event) => {
        const target = event.target;
        if (target.id && _currentTextElementsMap.has(target.id)) {
            const clickedSegment = _currentSrtSegments.find(segment => segment.id === target.id);
            if (clickedSegment && _audioPlayer) {
                console.log(`[audio-sync.js] Seeking to segment '${clickedSegment.id}' at ${clickedSegment.start}s`);
                _audioPlayer.currentTime = clickedSegment.start;
                _audioPlayer.play();
                event.stopPropagation();
            }
        }
    };

    // -----------------------------------------------------------
    // 私有通用函数
    // -----------------------------------------------------------

    const _isElementInViewport = (el) => {
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    };

    const _addAudioControls = (audioPlayer) => {
        let controlDiv = document.getElementById('audio-controls');
        if (!controlDiv) {
            controlDiv = document.createElement('div');
            controlDiv.id = 'audio-controls';
            controlDiv.style.marginTop = '15px';
            controlDiv.style.display = 'flex';
            controlDiv.style.alignItems = 'center';
            controlDiv.style.gap = '10px';
            // 将控制区插入到音频播放器之后
            audioPlayer.parentNode.insertBefore(controlDiv, audioPlayer.nextSibling);
        } else {
            controlDiv.innerHTML = ''; // 清空旧的控制
        }

        const speedLabel = document.createElement('label');
        speedLabel.textContent = '播放速度: ';
        speedLabel.htmlFor = 'playback-speed-select';
        controlDiv.appendChild(speedLabel);

        const speedSelect = document.createElement('select');
        speedSelect.id = 'playback-speed-select';
        const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
        speeds.forEach(speed => {
            const option = document.createElement('option');
            option.value = speed;
            option.textContent = `${speed}x`;
            if (speed === audioPlayer.playbackRate) {
                option.selected = true;
            }
            speedSelect.appendChild(option);
        });

        speedSelect.addEventListener('change', (e) => {
            audioPlayer.playbackRate = parseFloat(e.target.value);
            console.log(`[audio-sync.js] Playback speed set to ${audioPlayer.playbackRate}x`);
        });
        controlDiv.appendChild(speedSelect);

        const loopButton = document.createElement('button');
        loopButton.id = 'loop-segment-button';
        loopButton.textContent = '循环当前句段';
        loopButton.style.padding = '8px 12px';
        loopButton.style.backgroundColor = '#007bff';
        loopButton.style.color = 'white';
        loopButton.style.border = 'none';
        loopButton.style.borderRadius = '5px';
        loopButton.style.cursor = 'pointer';

        const updateLoopButtonState = () => {
            if (_loopSegmentActive) {
                loopButton.textContent = '停止循环';
                loopButton.style.backgroundColor = '#dc3545';
            } else {
                loopButton.textContent = '循环当前句段';
                loopButton.style.backgroundColor = '#007bff';
            }
        };
        updateLoopButtonState();

        loopButton.addEventListener('click', () => {
            _toggleLoopSegment(!_loopSegmentActive);
            updateLoopButtonState();
        });
        controlDiv.appendChild(loopButton);
    };

    const _toggleLoopSegment = (activate) => {
        _loopSegmentActive = activate;

        if (activate) {
            if (_currentHighlightedElement && _currentSrtSegments) {
                _currentLoopSegment = _currentSrtSegments.find(
                    segment => segment.id === _currentHighlightedElement.id
                );
            } else {
                _currentLoopSegment = _currentSrtSegments ? _currentSrtSegments[0] : null;
                if (_currentLoopSegment) {
                    console.warn("[audio-sync.js] No current highlighted element, starting loop from the first segment.");
                }
            }

            if (_currentLoopSegment && _audioPlayer) {
                console.log(`[audio-sync.js] Activating loop for segment '${_currentLoopSegment.id}' from ${_currentLoopSegment.start}s to ${_currentLoopSegment.end}s.`);
                _audioPlayer.currentTime = _currentLoopSegment.start;
                _audioPlayer.play();
            } else {
                console.warn("[audio-sync.js] Could not start loop: No current segment to loop or audio player not ready.");
                _loopSegmentActive = false;
            }
        } else {
            _currentLoopSegment = null;
            console.log("[audio-sync.js] Deactivating segment loop.");
        }
        // 强制更新按钮状态
        const loopButton = document.getElementById('loop-segment-button');
        if (loopButton) {
            if (_loopSegmentActive) {
                loopButton.textContent = '停止循环';
                loopButton.style.backgroundColor = '#dc3545';
            } else {
                loopButton.textContent = '循环当前句段';
                loopButton.style.backgroundColor = '#007bff';
            }
        }
    };

    return {
        init: init,
        cleanup: cleanup // 暴露清理接口
    };
})();

