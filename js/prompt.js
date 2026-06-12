// TraceLine CAD 2D - Prompt System (AutoCAD-style command line)
// Module: prompt.js

const PROMPT = {
    history: [],
    message: '',
    prefix: 'Comando:',

    log(text, prefix = null) {
        const line = prefix ? `<span class="prompt-prefix">${prefix}</span> ${text}` : text;
        this.history.push(`<div class="prompt-line">${line}</div>`);
        if (this.history.length > 20) this.history.shift();
        this._renderHistory();
    },

    msg(text) {
        this.message = text;
        document.getElementById('prompt-message').innerText = text;
    },

    setPrefix(text) {
        this.prefix = text;
        document.getElementById('prompt-prefix').innerText = text;
    },

    clear() {
        this.history = [];
        this.message = '';
        this.prefix = 'Comando:';
        this._renderHistory();
        document.getElementById('prompt-message').innerText = '';
        document.getElementById('prompt-prefix').innerText = this.prefix;
    },

    _renderHistory() {
        document.getElementById('prompt-history').innerHTML = this.history.join('');
        document.getElementById('command-prompt').scrollTop = document.getElementById('command-prompt').scrollHeight;
    }
};

function focusPrompt() {
    document.getElementById('prompt-input').focus();
}

function getPromptInput() {
    return document.getElementById('prompt-input').value.trim();
}

function clearPromptInput() {
    document.getElementById('prompt-input').value = '';
}

function logClick(pt) {
    PROMPT.log(`${pt.x.toFixed(1)},${(-pt.y).toFixed(1)}`);
}

// Process keyboard input
const promptInput = document.getElementById('prompt-input');

promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.stopPropagation();
        const val = promptInput.value.trim();
        promptInput.value = '';
        if (val) processPromptInput(val);
    }
    if (e.key === 'Escape') {
        e.stopPropagation();
        promptInput.value = '';
        handleEscape();
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        handleEscape();
        return;
    }
    if (e.key === 'T' && e.shiftKey) {
        OTRACK.clear();
        trackedPoints = [];
        drawEverything();
        return;
    }
    if (document.activeElement !== promptInput && e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        promptInput.focus();
    }
});

function handleEscape() {
    if (currentMode === 'polyline' && currentPoints.length > 1) {
        shapes.push(new Polyline(currentPoints));
    }
    resetState();
}

function processPromptInput(val) {
    if (!val) return;
    PROMPT.log(val, PROMPT.prefix);

    // Offset
    if (currentMode === 'offset' && !isNaN(parseFloat(val))) {
        offsetDistance = Math.abs(parseFloat(val));
        PROMPT.msg(`Offset: distância=${offsetDistance}`);
        return;
    }

    // Rotate: degrees
    if (currentMode === 'rotate' && selectionPhase === 'target' && rotateBasePoint !== null && !isNaN(parseFloat(val))) {
        const degrees = parseFloat(val);
        const angle = degrees * Math.PI / 180;
        rotateShapesInPlace(selectedShapes, rotateBasePoint, angle);
        rotateAngle += angle;
        PROMPT.msg(`Rotação: ${degrees}° aplicada.`);
        drawEverything();
        return;
    }

    // Absolute coordinates (x,y)
    if (val.includes(',')) {
        const parts = val.split(',');
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        if (!isNaN(x) && !isNaN(y)) {
            addPointToCreation(new Point(x, -y));
        }
        return;
    }

    // Relative distance
    if (!isNaN(parseFloat(val))) {
        const dist = parseFloat(val);
        const basePt = getBasePoint();
        if (basePt) {
            let angle;
            if (currentPolarAngle !== null) {
                angle = currentPolarAngle;
            } else if (currentMode === 'polyline' && currentPoints.length >= 2) {
                const prevPt = currentPoints[currentPoints.length - 2];
                angle = Math.atan2(basePt.y - prevPt.y, basePt.x - prevPt.x);
            } else {
                const dx = computedPt.x - basePt.x;
                const dy = computedPt.y - basePt.y;
                angle = (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) ? 0 : Math.atan2(dy, dx);
            }
            const targetPt = new Point(basePt.x + dist * Math.cos(angle), basePt.y + dist * Math.sin(angle));
            executeAction(targetPt);
            PROMPT.log(`${dist} < ${Math.round(angle * 180 / Math.PI)}°`);
        }
        return;
    }

    PROMPT.msg(`Não reconhecido: "${val}"`);
}

function getBasePoint() {
    if (currentPoints.length > 0) return currentPoints[currentPoints.length - 1];
    if (currentMode === 'move' && moveBasePoint) return moveBasePoint;
    if (currentMode === 'copy' && copyBasePoint) return copyBasePoint;
    return null;
}

function executeAction(pt) {
    if (currentMode === 'move' && selectionPhase === 'target') {
        applyMoveMultiple(selectedShapes, moveBasePoint, pt);
        clearSelection(); resetState();
    } else if (currentMode === 'copy' && selectionPhase === 'target') {
        applyCopyMultiple(selectedShapes, copyBasePoint, pt);
        copyBasePoint = pt;
        PROMPT.msg(`Cópia criada. Clique ou digite distância.`);
        drawEverything();
    } else if (currentMode === 'rotate' && selectionPhase === 'target') {
        const targetAngle = Math.atan2(pt.y - rotateBasePoint.y, pt.x - rotateBasePoint.x);
        const deltaAngle = targetAngle - rotateAngle;
        rotateShapesInPlace(selectedShapes, rotateBasePoint, deltaAngle);
        rotateAngle = targetAngle;
        drawEverything();
    } else {
        addPointToCreation(pt);
    }
}
