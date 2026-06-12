// TraceLine CAD 2D - OTrack (Object Snap Tracking) System
// Module: otrack.js

const OTRACK = {
    tracked: [],
    maxTracked: 3,
    computedPoint: null,

    addPoint(pt) {
        const isDuplicate = this.tracked.some(t => t.point.distanceTo(pt) < 0.01);
        if (!isDuplicate) {
            if (this.tracked.length >= this.maxTracked) this.tracked.shift();
            this.tracked.push({ point: new Point(pt.x, pt.y) });
        }
    },

    clear() {
        this.tracked = [];
        this.computedPoint = null;
    },

    computePoint(modelMouse, basePt = null) {
        const tolerance = SNAP_TOLERANCE_SCREEN / zoom;

        this._buildGuides();

        // 1. Direct snap
        for (const snap of getAllSnapPoints()) {
            if (modelMouse.distanceTo(snap.point) < tolerance) {
                this.addPoint(snap.point);
                this.computedPoint = snap.point;
                activeSnap = { point: snap.point, type: snap.type };
                currentPolarAngle = null;
                return;
            }
        }

        // 2. OTrack intersections
        if (this.tracked.length >= 2) {
            const interPt = this._findGuideIntersections(modelMouse, tolerance);
            if (interPt) {
                this.computedPoint = interPt;
                activeSnap = null;
                currentPolarAngle = null;
                return;
            }
        }

        // 3. OTrack projection
        if (this.tracked.length > 0) {
            const projPt = this._findGuideProjection(modelMouse, tolerance);
            if (projPt) {
                this.computedPoint = projPt;
                activeSnap = null;
                currentPolarAngle = null;
                return;
            }
        }

        // 4. Polar
        if (basePt) {
            const polarAngle = this._findPolarAngle(modelMouse, basePt);
            if (polarAngle !== null) {
                const dist = basePt.distanceTo(modelMouse);
                this.computedPoint = new Point(
                    basePt.x + dist * Math.cos(polarAngle),
                    basePt.y + dist * Math.sin(polarAngle)
                );
                currentPolarAngle = polarAngle;
                activeSnap = null;
                return;
            }
        }

        // 5. Free
        this.computedPoint = modelMouse;
        currentPolarAngle = null;
        activeSnap = null;
    },

    _buildGuides() {
        activeOTrackLines = [];
        this.tracked.forEach((tp) => {
            activeOTrackLines.push({ p1: new Point(-50000, tp.point.y), p2: new Point(50000, tp.point.y) });
            activeOTrackLines.push({ p1: new Point(tp.point.x, -50000), p2: new Point(tp.point.x, 50000) });
        });
    },

    _findGuideIntersections(modelMouse, tolerance) {
        let bestPt = null, bestDist = tolerance;
        for (let i = 0; i < this.tracked.length; i++) {
            for (let j = 0; j < this.tracked.length; j++) {
                if (i === j) continue;
                const inter = new Point(this.tracked[j].point.x, this.tracked[i].point.y);
                const dist = modelMouse.distanceTo(inter);
                if (dist < bestDist) { bestDist = dist; bestPt = inter; }
            }
        }
        return bestPt;
    },

    _findGuideProjection(modelMouse, tolerance) {
        let bestPt = null, bestDist = tolerance;
        for (const tp of this.tracked) {
            const distH = Math.abs(modelMouse.y - tp.point.y);
            if (distH < bestDist) { bestDist = distH; bestPt = new Point(modelMouse.x, tp.point.y); }
            const distV = Math.abs(modelMouse.x - tp.point.x);
            if (distV < bestDist) { bestDist = distV; bestPt = new Point(tp.point.x, modelMouse.y); }
        }
        return bestPt;
    },

    _findPolarAngle(modelMouse, basePt) {
        let angle = Math.atan2(modelMouse.y - basePt.y, modelMouse.x - basePt.x);
        if (angle < 0) angle += 2 * Math.PI;
        for (const targetDeg of POLAR_ANGLES) {
            const targetRad = targetDeg * (Math.PI / 180);
            let diff = Math.abs(angle - targetRad);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff < POLAR_TOLERANCE) return targetRad;
        }
        return null;
    }
};

function processCalculatedPoint() {
    const modelMouse = screenToModel(screenMousePos);

    if (isSelectingBox ||
        (currentMode === 'move' && selectionPhase === 'select') ||
        (currentMode === 'copy' && selectionPhase === 'select') ||
        (currentMode === 'rotate' && selectionPhase === 'select') ||
        (currentMode === 'mirror' && selectionPhase === 'select') ||
        (currentMode === 'extend' && extendPhase === 'boundary') ||
        ['trim', 'offset', 'delete'].includes(currentMode)) {
        computedPt = modelMouse;
        OTRACK.computedPoint = modelMouse;
        activeSnap = null;
        currentPolarAngle = null;
        activeOTrackLines = [];
        return;
    }

    let basePt = null;
    if (currentPoints.length > 0) basePt = currentPoints[currentPoints.length - 1];
    else if (currentMode === 'move' && moveBasePoint && selectionPhase === 'target') basePt = moveBasePoint;
    else if (currentMode === 'copy' && copyBasePoint && selectionPhase === 'target') basePt = copyBasePoint;
    else if (currentMode === 'rotate' && rotateBasePoint && selectionPhase === 'target') basePt = rotateBasePoint;
    else if (currentMode === 'mirror' && mirrorAxisP1 && selectionPhase === 'axis2') basePt = mirrorAxisP1;

    OTRACK.computePoint(modelMouse, basePt);
    computedPt = OTRACK.computedPoint;
    trackedPoints = OTRACK.tracked.map(t => t.point);
}
