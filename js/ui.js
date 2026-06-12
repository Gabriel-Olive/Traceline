// TraceLine CAD 2D - UI and Rendering
// Module: ui.js

const canvas = document.getElementById('cadCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    drawEverything();
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 100);

function setMode(mode) {
    currentMode = mode; resetState();
    document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
    if(document.getElementById(`btn-${mode}`)) document.getElementById(`btn-${mode}`).classList.add('active');
    document.getElementById('mode-display').innerText = mode.toUpperCase();
    PROMPT.clear();
    updateInstructions(); drawEverything();
}

function resetState() {
    currentPoints = []; moveBasePoint = null; mirrorAxisP1 = null; copyBasePoint = null;
    rotateBasePoint = null; isSelectingBox = false; selectionPhase = "select";
    extendBoundaries = []; extendPhase = "boundary";
    OTRACK.clear(); trackedPoints = [];
    updateInstructions(); drawEverything();
    focusPrompt();
}

function clearCanvas() { shapes = []; selectedShapes = []; clearSelection(); resetState(); }

function updateInstructions() {
    let inst = "";
    if (currentMode === 'line' || currentMode === 'circle') inst = "Clique para iniciar.";
    else if (currentMode === 'polyline') inst = "Clique nos pontos. Enter para finalizar.";
    else if (currentMode === 'arc') {
        if (currentPoints.length === 0) inst = "[Arco 1/3] Clique no ponto inicial.";
        else if (currentPoints.length === 1) inst = "[Arco 2/3] Clique no ponto final.";
        else inst = "[Arco 3/3] Clique no ponto de curvatura.";
    }
    else if (currentMode === 'trim') inst = "Clique nas pontas para cortar.";
    else if (currentMode === 'offset') inst = `Offset: distância=${offsetDistance}. Clique na linha.`;
    else if (currentMode === 'delete') inst = "Clique no objeto para apagar.";
    else if (currentMode === 'move') {
        if (selectionPhase === "select") inst = "[Move] Selecione. Enter para confirmar.";
        else if (selectionPhase === "basepoint") inst = "[Move] Clique no ponto base.";
        else inst = "[Move] Clique no destino ou digite distância.";
    }
    else if (currentMode === 'mirror') {
        if (selectionPhase === "select") inst = "[Mirror] Selecione. Enter para confirmar.";
        else if (selectionPhase === "axis1") inst = "[Mirror] Clique no 1º ponto do eixo.";
        else inst = "[Mirror] Clique no 2º ponto do eixo.";
    }
    else if (currentMode === 'copy') {
        if (selectionPhase === "select") inst = "[Copy] Selecione. Enter para confirmar.";
        else inst = "[Copy] Clique base → destino.";
    }
    else if (currentMode === 'rotate') {
        if (selectionPhase === "select") inst = "[Rotate] Selecione. Enter para confirmar.";
        else inst = "[Rotate] Clique no centro, mova ou digite graus.";
    }
    else if (currentMode === 'extend') {
        if (extendPhase === "boundary") inst = "[Extend] Selecione limites. Enter para confirmar.";
        else inst = "[Extend] Clique nos objetos a estender.";
    }
    PROMPT.setPrefix(`${currentMode.toUpperCase()}>`);
    PROMPT.msg(inst);
    focusPrompt();
}

function addPointToCreation(pt) {
    logClick(pt);
    if (currentMode === 'line') {
        if (currentPoints.length === 0) currentPoints.push(pt);
        else { shapes.push(new Line(currentPoints[0], pt)); currentPoints = [pt]; }
    } else if (currentMode === 'polyline') {
        currentPoints.push(pt);
    } else if (currentMode === 'circle') {
        if (currentPoints.length === 0) currentPoints.push(pt);
        else { shapes.push(new Circle(currentPoints[0], currentPoints[0].distanceTo(pt))); currentPoints = []; }
    } else if (currentMode === 'arc') {
        currentPoints.push(pt);
        if (currentPoints.length === 3) {
            const arc = new Arc(currentPoints[0], currentPoints[2], currentPoints[1]);
            if (arc.valid) shapes.push(arc);
            currentPoints = [];
        }
    }
    drawEverything();
}

// --- Rendering ---
function drawEverything() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(panX, panY); ctx.scale(zoom, zoom);

    // Origin axes
    ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 1 / zoom; ctx.beginPath(); ctx.moveTo(0, -30/zoom); ctx.lineTo(0, 30/zoom); ctx.stroke();
    ctx.strokeStyle = '#33ff33'; ctx.lineWidth = 1 / zoom; ctx.beginPath(); ctx.moveTo(-30/zoom, 0); ctx.lineTo(30/zoom, 0); ctx.stroke();

    // Shapes
    shapes.forEach(shape => {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 / zoom;
        shape.draw(ctx, selectedShapes.some(sel => sel.id === shape.id));
    });

    // Drawing elastics
    ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 1 / zoom; ctx.setLineDash([4 / zoom, 4 / zoom]);
    if (currentPoints.length > 0) {
        if (currentMode === 'line') {
            ctx.beginPath(); ctx.moveTo(currentPoints[0].x, currentPoints[0].y); ctx.lineTo(computedPt.x, computedPt.y); ctx.stroke();
        } else if (currentMode === 'polyline') {
            ctx.beginPath(); ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
            for(let i=1; i<currentPoints.length; i++) ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
            ctx.lineTo(computedPt.x, computedPt.y); ctx.stroke();
        } else if (currentMode === 'circle') {
            ctx.beginPath(); ctx.arc(currentPoints[0].x, currentPoints[0].y, currentPoints[0].distanceTo(computedPt), 0, 2*Math.PI); ctx.stroke();
        } else if (currentMode === 'arc') {
            if (currentPoints.length >= 1) {
                ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = '#ff9900'; ctx.lineWidth = 2 / zoom;
                const s = 6 / zoom;
                ctx.beginPath(); ctx.moveTo(currentPoints[0].x - s, currentPoints[0].y - s); ctx.lineTo(currentPoints[0].x + s, currentPoints[0].y + s);
                ctx.moveTo(currentPoints[0].x + s, currentPoints[0].y - s); ctx.lineTo(currentPoints[0].x - s, currentPoints[0].y + s); ctx.stroke();
                ctx.restore();
                ctx.beginPath(); ctx.moveTo(currentPoints[0].x, currentPoints[0].y); ctx.lineTo(computedPt.x, computedPt.y); ctx.stroke();
            }
            if (currentPoints.length === 2) {
                ctx.beginPath(); ctx.moveTo(currentPoints[1].x, currentPoints[1].y); ctx.lineTo(computedPt.x, computedPt.y); ctx.stroke();
                const previewArc = new Arc(currentPoints[0], computedPt, currentPoints[1]);
                if (previewArc.valid) { ctx.save(); ctx.setLineDash([4/zoom, 4/zoom]); ctx.strokeStyle = '#ff9900'; ctx.lineWidth = 1.5 / zoom; previewArc.draw(ctx, false); ctx.restore(); }
                ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = '#ff9900'; ctx.lineWidth = 2 / zoom;
                const s = 6 / zoom; ctx.beginPath(); ctx.moveTo(currentPoints[1].x - s, currentPoints[1].y - s); ctx.lineTo(currentPoints[1].x + s, currentPoints[1].y + s);
                ctx.moveTo(currentPoints[1].x + s, currentPoints[1].y - s); ctx.lineTo(currentPoints[1].x - s, currentPoints[1].y + s); ctx.stroke(); ctx.restore();
            }
        }
    }

    // Move preview
    if (currentMode === 'move' && selectionPhase === 'target' && moveBasePoint) {
        ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 1.5 / zoom;
        let dx = computedPt.x - moveBasePoint.x, dy = computedPt.y - moveBasePoint.y;
        ctx.save(); ctx.translate(dx, dy); selectedShapes.forEach(s => s.draw(ctx, false)); ctx.restore();
    }

    // Copy preview
    if (currentMode === 'copy' && selectionPhase === 'target' && copyBasePoint) {
        ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1.5 / zoom; ctx.setLineDash([4/zoom, 3/zoom]);
        let dx = computedPt.x - copyBasePoint.x, dy = computedPt.y - copyBasePoint.y;
        ctx.save(); ctx.translate(dx, dy); selectedShapes.forEach(s => s.draw(ctx, false)); ctx.restore();
        ctx.setLineDash([]);
    }

    // Rotate preview
    if (currentMode === 'rotate' && selectionPhase === 'target' && rotateBasePoint) {
        ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 1.5 / zoom; ctx.setLineDash([4/zoom, 3/zoom]);
        ctx.beginPath(); ctx.moveTo(rotateBasePoint.x, rotateBasePoint.y); ctx.lineTo(computedPt.x, computedPt.y); ctx.stroke();
        const dist = rotateBasePoint.distanceTo(computedPt);
        ctx.beginPath(); ctx.arc(rotateBasePoint.x, rotateBasePoint.y, dist, 0, 2*Math.PI); ctx.stroke();
        const targetAngle = Math.atan2(computedPt.y - rotateBasePoint.y, computedPt.x - rotateBasePoint.x);
        const deltaAngle = targetAngle - rotateAngle;
        ctx.save(); ctx.setLineDash([3/zoom, 3/zoom]); ctx.strokeStyle = 'rgba(255, 136, 0, 0.55)'; ctx.lineWidth = 1.5 / zoom;
        selectedShapes.forEach(shape => {
            const rotated = rotateShape(shape, rotateBasePoint, deltaAngle);
            if (rotated) rotated.draw(ctx, false);
        });
        ctx.restore(); ctx.setLineDash([]);
    }

    // Mirror preview
    if (currentMode === 'mirror') {
        if (selectionPhase === 'axis2' && mirrorAxisP1) {
            const axisEnd = computedPt;
            ctx.save(); ctx.setLineDash([6/zoom, 4/zoom]); ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 1.5 / zoom;
            const dx = axisEnd.x - mirrorAxisP1.x, dy = axisEnd.y - mirrorAxisP1.y;
            const len = Math.hypot(dx, dy) || 1; const ext = 10000;
            ctx.beginPath(); ctx.moveTo(mirrorAxisP1.x - (dx/len)*ext, mirrorAxisP1.y - (dy/len)*ext);
            ctx.lineTo(axisEnd.x + (dx/len)*ext, axisEnd.y + (dy/len)*ext); ctx.stroke();
            ctx.restore();
            ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 2/zoom;
            const s = 6/zoom; ctx.beginPath();
            ctx.moveTo(mirrorAxisP1.x-s, mirrorAxisP1.y-s); ctx.lineTo(mirrorAxisP1.x+s, mirrorAxisP1.y+s);
            ctx.moveTo(mirrorAxisP1.x+s, mirrorAxisP1.y-s); ctx.lineTo(mirrorAxisP1.x-s, mirrorAxisP1.y+s); ctx.stroke(); ctx.restore();
            ctx.save(); ctx.setLineDash([3/zoom, 3/zoom]); ctx.strokeStyle = 'rgba(255, 100, 255, 0.55)'; ctx.lineWidth = 1.5 / zoom;
            selectedShapes.forEach(shape => { const mirrored = mirrorShape(shape, mirrorAxisP1, axisEnd); if (mirrored) mirrored.draw(ctx, false); });
            ctx.restore();
        }
        if (selectionPhase === 'axis1') {
            ctx.save(); ctx.setLineDash([6/zoom, 4/zoom]); ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 1 / zoom;
            ctx.beginPath(); ctx.moveTo(computedPt.x - 10000, computedPt.y); ctx.lineTo(computedPt.x + 10000, computedPt.y); ctx.stroke();
            ctx.restore();
        }
    }

    // Extend boundaries highlight
    if (currentMode === 'extend' && extendBoundaries.length > 0) {
        ctx.save(); ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)'; ctx.lineWidth = 3 / zoom;
        extendBoundaries.forEach(s => s.draw(ctx, false));
        ctx.restore();
    }

    // Polar
    if (currentPolarAngle !== null && !activeSnap && (currentPoints.length > 0 || (currentMode === 'move' && selectionPhase === 'target' && moveBasePoint) || (currentMode === 'mirror' && selectionPhase === 'axis2' && mirrorAxisP1))) {
        let bp = currentPoints.length > 0 ? currentPoints[currentPoints.length - 1] : (currentMode === 'mirror' ? mirrorAxisP1 : moveBasePoint);
        ctx.strokeStyle = '#00bcff'; ctx.lineWidth = 1 / zoom; ctx.beginPath(); ctx.moveTo(bp.x, bp.y);
        ctx.lineTo(bp.x + Math.cos(currentPolarAngle)*20000, bp.y + Math.sin(currentPolarAngle)*20000); ctx.stroke();
    }

    // Selection boxes
    if (isSelectingBox && selectionStartPt) {
        let endPt = screenToModel(screenMousePos); let isCrossing = selectionStartPt.x > endPt.x;
        if (isCrossing) { ctx.fillStyle = 'rgba(0, 255, 100, 0.15)'; ctx.strokeStyle = '#00ff64'; ctx.setLineDash([4 / zoom, 4 / zoom]); }
        else { ctx.fillStyle = 'rgba(0, 110, 255, 0.15)'; ctx.strokeStyle = '#0070ff'; }
        ctx.lineWidth = 1 / zoom;
        ctx.fillRect(selectionStartPt.x, selectionStartPt.y, endPt.x - selectionStartPt.x, endPt.y - selectionStartPt.y);
        ctx.strokeRect(selectionStartPt.x, selectionStartPt.y, endPt.x - selectionStartPt.x, endPt.y - selectionStartPt.y);
        ctx.setLineDash([]);
    }

    // OTrack guides
    if (activeOTrackLines.length > 0) {
        ctx.save(); ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)'; ctx.lineWidth = 1 / zoom; ctx.setLineDash([5 / zoom, 3 / zoom]);
        activeOTrackLines.forEach(vl => { ctx.beginPath(); ctx.moveTo(vl.p1.x, vl.p1.y); ctx.lineTo(vl.p2.x, vl.p2.y); ctx.stroke(); });
        ctx.restore();
    }

    ctx.restore();

    // Snap indicator
    if (activeSnap) {
        const sX = activeSnap.point.x * zoom + panX; const sY = activeSnap.point.y * zoom + panY;
        ctx.lineWidth = 2; const size = 10; ctx.strokeStyle = '#5cff5c';
        if (activeSnap.type === 'endpoint') ctx.strokeRect(sX - size/2, sY - size/2, size, size);
        else if (activeSnap.type === 'vertex') { ctx.beginPath(); ctx.moveTo(sX, sY - size/2); ctx.lineTo(sX + size/2, sY); ctx.lineTo(sX, sY + size/2); ctx.lineTo(sX - size/2, sY); ctx.closePath(); ctx.stroke(); }
        else if (activeSnap.type === 'midpoint') { ctx.beginPath(); ctx.moveTo(sX, sY - size/2); ctx.lineTo(sX + size/2, sY + size/2); ctx.lineTo(sX - size/2, sY + size/2); ctx.closePath(); ctx.stroke(); }
        else if (activeSnap.type === 'center') { ctx.beginPath(); ctx.arc(sX, sY, size/2, 0, 2*Math.PI); ctx.stroke(); }
        else if (activeSnap.type === 'quadrant') { ctx.beginPath(); ctx.moveTo(sX, sY - size/2); ctx.lineTo(sX + size/2, sY); ctx.lineTo(sX, sY + size/2); ctx.lineTo(sX - size/2, sY); ctx.closePath(); ctx.stroke(); }
    }
    else if (computedPt && OTRACK.tracked.length >= 2) {
        for (let i = 0; i < OTRACK.tracked.length; i++) {
            for (let j = 0; j < OTRACK.tracked.length; j++) {
                if (i === j) continue;
                const inter = new Point(OTRACK.tracked[j].point.x, OTRACK.tracked[i].point.y);
                if (computedPt.distanceTo(inter) < 0.01) {
                    const sX = inter.x * zoom + panX; const sY = inter.y * zoom + panY;
                    ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2; const size = 8;
                    ctx.beginPath(); ctx.moveTo(sX - size/2, sY - size/2); ctx.lineTo(sX + size/2, sY + size/2);
                    ctx.moveTo(sX + size/2, sY - size/2); ctx.lineTo(sX - size/2, sY + size/2); ctx.stroke();
                    break;
                }
            }
        }
    }
}