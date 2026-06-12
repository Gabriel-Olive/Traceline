// TraceLine CAD 2D - Mouse Events
// Module: mouse.js

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
        isPanning = true; startPan = { x: e.clientX - panX, y: e.clientY - panY }; e.preventDefault(); return;
    }
    if (e.button !== 0) return;

    const snapClickModel = new Point(computedPt.x, computedPt.y);
    const pureModelMouse = screenToModel(screenMousePos);

    logClick(snapClickModel);

    // MOVE
    if (currentMode === 'move') {
        if (selectionPhase === "select") {
            let clickedShape = getShapeUnderMouse(pureModelMouse);
            if (clickedShape) {
                if (!selectedShapes.some(s => s.id === clickedShape.id)) selectedShapes.push(clickedShape);
                document.getElementById('select-count').innerText = selectedShapes.length;
            } else { isSelectingBox = true; selectionStartPt = pureModelMouse; }
            updateInstructions(); drawEverything(); return;
        } else if (selectionPhase === "basepoint") {
            moveBasePoint = snapClickModel; selectionPhase = "target";
            updateInstructions(); drawEverything(); return;
        } else if (selectionPhase === "target") {
            applyMoveMultiple(selectedShapes, moveBasePoint, snapClickModel);
            clearSelection(); resetState(); PROMPT.msg(`Move concluído.`); return;
        }
    }

    // MIRROR
    if (currentMode === 'mirror') {
        if (selectionPhase === 'select') {
            const clickedShape = getShapeUnderMouse(pureModelMouse);
            if (clickedShape) {
                if (!selectedShapes.some(s => s.id === clickedShape.id)) selectedShapes.push(clickedShape);
                document.getElementById('select-count').innerText = selectedShapes.length;
            } else { isSelectingBox = true; selectionStartPt = pureModelMouse; }
            updateInstructions(); drawEverything(); return;
        } else if (selectionPhase === 'axis1') {
            mirrorAxisP1 = snapClickModel; selectionPhase = 'axis2';
            updateInstructions(); drawEverything(); return;
        } else if (selectionPhase === 'axis2') {
            applyMirror(selectedShapes, mirrorAxisP1, snapClickModel);
            mirrorAxisP1 = null; clearSelection(); resetState();
            PROMPT.msg(`Mirror concluído.`); return;
        }
    }

    // COPY
    if (currentMode === 'copy') {
        if (selectionPhase === 'select') {
            const clickedShape = getShapeUnderMouse(pureModelMouse);
            if (clickedShape) {
                if (!selectedShapes.some(s => s.id === clickedShape.id)) selectedShapes.push(clickedShape);
                document.getElementById('select-count').innerText = selectedShapes.length;
            } else { isSelectingBox = true; selectionStartPt = pureModelMouse; }
            updateInstructions(); drawEverything(); return;
        } else if (selectionPhase === 'basepoint') {
            copyBasePoint = snapClickModel; selectionPhase = 'target';
            updateInstructions(); drawEverything(); return;
        } else if (selectionPhase === 'target') {
            applyCopyMultiple(selectedShapes, copyBasePoint, snapClickModel);
            copyBasePoint = snapClickModel;
            PROMPT.msg(`Cópia criada. Clique novamente ou digite distância.`);
            drawEverything(); return;
        }
    }

    // ROTATE
    if (currentMode === 'rotate') {
        if (selectionPhase === 'select') {
            const clickedShape = getShapeUnderMouse(pureModelMouse);
            if (clickedShape) {
                if (!selectedShapes.some(s => s.id === clickedShape.id)) selectedShapes.push(clickedShape);
                document.getElementById('select-count').innerText = selectedShapes.length;
            } else { isSelectingBox = true; selectionStartPt = pureModelMouse; }
            updateInstructions(); drawEverything(); return;
        } else if (selectionPhase === 'basepoint') {
            rotateBasePoint = snapClickModel; rotateAngle = 0; selectionPhase = 'target';
            updateInstructions(); drawEverything(); return;
        } else if (selectionPhase === 'target') {
            const targetAngle = Math.atan2(snapClickModel.y - rotateBasePoint.y, snapClickModel.x - rotateBasePoint.x);
            const deltaAngle = targetAngle - rotateAngle;
            rotateShapesInPlace(selectedShapes, rotateBasePoint, deltaAngle);
            rotateAngle = targetAngle;
            PROMPT.msg(`Rotação aplicada. Clique novamente ou digite graus.`);
            drawEverything(); return;
        }
    }

    // EXTEND
    if (currentMode === 'extend') {
        if (extendPhase === 'boundary') {
            const clickedShape = getShapeUnderMouse(pureModelMouse);
            if (clickedShape) {
                if (!extendBoundaries.some(s => s.id === clickedShape.id)) extendBoundaries.push(clickedShape);
            } else { isSelectingBox = true; selectionStartPt = pureModelMouse; }
            updateInstructions(); drawEverything(); return;
        } else {
            runExtend(pureModelMouse); drawEverything(); return;
        }
    }

    // DELETE
    if (currentMode === 'delete') {
        let clickedShape = getShapeUnderMouse(pureModelMouse);
        if (clickedShape) shapes = shapes.filter(s => s.id !== clickedShape.id);
        else { isSelectingBox = true; selectionStartPt = pureModelMouse; }
        drawEverything(); return;
    }

    // TRIM
    if (currentMode === 'trim') { runTrim(pureModelMouse); drawEverything(); return; }

    // OFFSET
    if (currentMode === 'offset') {
        let s = getShapeUnderMouse(pureModelMouse);
        if (s) runOffset(s, pureModelMouse, offsetDistance);
        drawEverything(); return;
    }

    // Drawing modes
    if (['line', 'polyline', 'circle', 'arc'].includes(currentMode)) {
        addPointToCreation(snapClickModel);
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 1) isPanning = false;
    if (e.button === 0 && isSelectingBox) {
        isSelectingBox = false;
        executeBoxSelection(selectionStartPt, screenToModel(screenMousePos));
        selectionStartPt = null; updateInstructions(); drawEverything();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    screenMousePos = new Point(e.clientX - rect.left, e.clientY - rect.top);
    if (isPanning) { panX = e.clientX - startPan.x; panY = e.clientY - startPan.y; drawEverything(); return; }
    processCalculatedPoint();
    document.getElementById('coord-display').innerText = `X: ${Math.round(computedPt.x)}, Y: ${Math.round(-computedPt.y)}`;
    drawEverything();
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    const modelPtBefore = screenToModel(new Point(mouseX, mouseY));
    if (e.deltaY < 0) zoom *= 1.1; else zoom /= 1.1;
    zoom = Math.max(0.05, Math.min(zoom, 50));
    panX = mouseX - modelPtBefore.x * zoom; panY = mouseY - modelPtBefore.y * zoom;
    processCalculatedPoint(); drawEverything();
}, { passive: false });
