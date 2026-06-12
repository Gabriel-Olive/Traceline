// TraceLine CAD 2D - Shape Operations (Trim, Extend, Move, Copy, Rotate, Mirror, Offset)
// Module: operations.js

// --- Selection ---
function getShapeUnderMouse(pt) {
    let threshold = 12 / zoom; let closestShape = null; let minDist = threshold;
    shapes.forEach(shape => {
        let d = shape.distanceToPoint(pt);
        if (d < minDist) { minDist = d; closestShape = shape; }
    });
    return closestShape;
}

function executeBoxSelection(start, end) {
    let xMin = Math.min(start.x, end.x); let xMax = Math.max(start.x, end.x);
    let yMin = Math.min(start.y, end.y); let yMax = Math.max(start.y, end.y);
    let isCrossing = start.x > end.x;
    shapes.forEach(shape => {
        if (selectedShapes.some(s => s.id === shape.id)) return;
        if (isCrossing ? shape.intersectsBox(xMin, xMax, yMin, yMax) : shape.isFullyInside(xMin, xMax, yMin, yMax)) {
            selectedShapes.push(shape);
        }
    });
    document.getElementById('select-count').innerText = selectedShapes.length;
}

function clearSelection() { selectedShapes = []; selectionPhase = "select"; document.getElementById('select-count').innerText = 0; drawEverything(); }

// --- Trim ---
function runTrimLine(segmentToTrim, clickPt) {
    let splitPoints = [];
    getAllPhysicalSegments().forEach(s => {
        const same = (s.p1 === segmentToTrim.p1 && s.p2 === segmentToTrim.p2);
        if (same) return;
        let inter = findLineIntersection(segmentToTrim.p1, segmentToTrim.p2, s.p1, s.p2, true);
        if (inter && inter.distanceTo(segmentToTrim.p1) > 0.01 && inter.distanceTo(segmentToTrim.p2) > 0.01) {
            if (!splitPoints.some(sp => sp.distanceTo(inter) < 0.01)) splitPoints.push(inter);
        }
    });
    shapes.forEach(shape => {
        let pts = [];
        if (shape instanceof Circle) pts = lineCircleIntersections(segmentToTrim.p1, segmentToTrim.p2, shape.center, shape.radius);
        else if (shape instanceof Arc && shape.valid) {
            pts = lineCircleIntersections(segmentToTrim.p1, segmentToTrim.p2, shape.center, shape.radius);
            pts = filterPointsOnArc(pts, shape);
        }
        pts.forEach(pt => {
            if (pt.distanceTo(segmentToTrim.p1) > 0.01 && pt.distanceTo(segmentToTrim.p2) > 0.01) {
                if (!splitPoints.some(sp => sp.distanceTo(pt) < 0.01)) splitPoints.push(pt);
            }
        });
    });
    const p1 = segmentToTrim.p1;
    splitPoints.sort((a, b) => p1.distanceTo(a) - p1.distanceTo(b));
    let subSegments = []; let currentStart = p1;
    splitPoints.forEach(pt => { subSegments.push(new Line(currentStart, pt)); currentStart = pt; });
    subSegments.push(new Line(currentStart, segmentToTrim.p2));
    let indexToRemove = -1;
    subSegments.forEach((sub, idx) => { if (sub.distanceToPoint(clickPt) < (12 / zoom)) indexToRemove = idx; });
    if (indexToRemove !== -1) {
        subSegments.splice(indexToRemove, 1);
        shapes = shapes.filter(s => s.id !== segmentToTrim.id);
        subSegments.forEach(sub => shapes.push(sub));
    }
}

function runTrimArcShape(arc, clickPt) {
    if (!arc.valid) return;
    const ccw = arc.counterClockwise;
    const startA = arc.startAngle, endA = arc.endAngle;
    let interAngles = collectCircleIntersectionAngles(arc.id, arc.center, arc.radius, true, startA, endA, ccw);
    if (interAngles.length === 0) return;
    interAngles.sort((a, b) => {
        const da = ccw ? normalizeAngle(a - startA) : normalizeAngle(startA - a);
        const db = ccw ? normalizeAngle(b - startA) : normalizeAngle(startA - b);
        return da - db;
    });
    const bounds = [startA, ...interAngles, endA];
    const clickAngle = normalizeAngle(Math.atan2(clickPt.y - arc.center.y, clickPt.x - arc.center.x));
    let indexToRemove = -1;
    for (let i = 0; i < bounds.length - 1; i++) {
        const sa = bounds[i], ea = bounds[i+1];
        const inSub = ccw ? angleInArc(clickAngle, sa, ea) : angleInArc(clickAngle, ea, sa);
        if (inSub) { indexToRemove = i; break; }
    }
    if (indexToRemove === -1) return;
    shapes = shapes.filter(s => s.id !== arc.id);
    for (let i = 0; i < bounds.length - 1; i++) {
        if (i !== indexToRemove) shapes.push(makeArcFromAngles(arc.center, arc.radius, bounds[i], bounds[i+1], ccw));
    }
}

function runTrimCircle(circle, clickPt) {
    let angles = collectCircleIntersectionAngles(circle.id, circle.center, circle.radius, false);
    if (angles.length === 0) return;
    angles.sort((a, b) => a - b);
    const n = angles.length;
    const clickAngle = normalizeAngle(Math.atan2(clickPt.y - circle.center.y, clickPt.x - circle.center.x));
    let indexToRemove = -1;
    for (let i = 0; i < n; i++) {
        const sa = angles[i];
        const ea = angles[(i + 1) % n];
        if (angleInArc(clickAngle, sa, ea)) { indexToRemove = i; break; }
    }
    if (indexToRemove === -1) return;
    shapes = shapes.filter(s => s.id !== circle.id);
    for (let i = 0; i < n; i++) {
        if (i !== indexToRemove) {
            const sa = angles[i];
            const ea = angles[(i + 1) % n];
            shapes.push(makeArcFromAngles(circle.center, circle.radius, sa, ea, true));
        }
    }
}

function runTrim(clickPt) {
    const threshold = 12 / zoom;
    let curvedShape = null, minCurved = threshold;
    shapes.forEach(shape => {
        if (shape instanceof Arc || shape instanceof Circle) {
            const d = shape.distanceToPoint(clickPt);
            if (d < minCurved) { minCurved = d; curvedShape = shape; }
        }
    });
    let segmentToTrim = null, minSeg = threshold;
    getAllPhysicalSegments().forEach(seg => {
        const d = seg.distanceToPoint(clickPt);
        if (d < minSeg) { minSeg = d; segmentToTrim = seg; }
    });
    if (segmentToTrim && minSeg <= minCurved) runTrimLine(segmentToTrim, clickPt);
    else if (curvedShape instanceof Circle) runTrimCircle(curvedShape, clickPt);
    else if (curvedShape instanceof Arc) runTrimArcShape(curvedShape, clickPt);
}

// --- Extend ---
function runExtend(clickPt) {
    const threshold = 12 / zoom;
    let shapeToExtend = null, minDist = threshold, segmentIndex = -1;

    shapes.forEach(shape => {
        if (extendBoundaries.some(b => b.id === shape.id)) return;
        if (shape instanceof Line) {
            const d = shape.distanceToPoint(clickPt);
            if (d < minDist) { minDist = d; shapeToExtend = shape; }
        }
    });
    shapes.forEach(shape => {
        if (extendBoundaries.some(b => b.id === shape.id)) return;
        if (shape instanceof Polyline) {
            for (let i = 0; i < shape.points.length - 1; i++) {
                const seg = new Line(shape.points[i], shape.points[i + 1]);
                const d = seg.distanceToPoint(clickPt);
                if (d < minDist) { minDist = d; shapeToExtend = shape; segmentIndex = i; }
            }
        }
    });
    shapes.forEach(shape => {
        if (extendBoundaries.some(b => b.id === shape.id)) return;
        if (shape instanceof Arc && shape.valid) {
            const d = shape.distanceToPoint(clickPt);
            if (d < minDist) { minDist = d; shapeToExtend = shape; }
        }
    });

    if (!shapeToExtend) return;

    let boundarySegments = [];
    extendBoundaries.forEach(boundary => {
        if (boundary instanceof Line) boundarySegments.push(boundary);
        else if (boundary instanceof Polyline) {
            for (let i = 0; i < boundary.points.length - 1; i++)
                boundarySegments.push(new Line(boundary.points[i], boundary.points[i + 1]));
        } else if (boundary instanceof Arc && boundary.valid) {
            for (let a = 0; a < 2 * Math.PI; a += Math.PI / 12) {
                const p1 = new Point(boundary.center.x + boundary.radius * Math.cos(a), boundary.center.y + boundary.radius * Math.sin(a));
                const p2 = new Point(boundary.center.x + boundary.radius * Math.cos(a + Math.PI / 12), boundary.center.y + boundary.radius * Math.sin(a + Math.PI / 12));
                boundarySegments.push(new Line(p1, p2));
            }
        }
    });
    if (boundarySegments.length === 0) return;

    if (shapeToExtend instanceof Line) runExtendLine(shapeToExtend, clickPt, boundarySegments);
    else if (shapeToExtend instanceof Arc && shapeToExtend.valid) runExtendArc(shapeToExtend, clickPt, boundarySegments);
    else if (shapeToExtend instanceof Polyline && segmentIndex >= 0) runExtendPolylineSegment(shapeToExtend, segmentIndex, clickPt, boundarySegments);
}

function runExtendLine(lineToExtend, clickPt, boundarySegments) {
    const distToP1 = lineToExtend.p1.distanceTo(clickPt);
    const distToP2 = lineToExtend.p2.distanceTo(clickPt);
    const endpointToMove = distToP1 < distToP2 ? lineToExtend.p1 : lineToExtend.p2;
    const endpointToKeep = distToP1 < distToP2 ? lineToExtend.p2 : lineToExtend.p1;
    const dirX = endpointToMove.x - endpointToKeep.x, dirY = endpointToMove.y - endpointToKeep.y;
    const dirLen = Math.hypot(dirX, dirY);
    if (dirLen < 0.01) return;
    const dirNX = dirX / dirLen, dirNY = dirY / dirLen;
    const extStart = new Point(endpointToKeep.x - dirX * 100, endpointToKeep.y - dirY * 100);
    const extEnd = new Point(endpointToKeep.x + dirX * 100, endpointToKeep.y + dirY * 100);
    let bestInter = null, bestDist = Infinity;
    for (const boundary of boundarySegments) {
        const inter = findLineIntersection(extStart, extEnd, boundary.p1, boundary.p2, true);
        if (!inter) continue;
        const proj = (inter.x - endpointToKeep.x) * dirNX + (inter.y - endpointToKeep.y) * dirNY;
        if (proj > dirLen * 0.99) {
            const dist = endpointToMove.distanceTo(inter);
            if (dist < bestDist) { bestDist = dist; bestInter = inter; }
        }
    }
    if (bestInter) {
        if (distToP1 < distToP2) lineToExtend.p1 = bestInter;
        else lineToExtend.p2 = bestInter;
    }
}

function runExtendArc(arcToExtend, clickPt, boundarySegments) {
    const distToP1 = arcToExtend.p1.distanceTo(clickPt);
    const distToP2 = arcToExtend.p2.distanceTo(clickPt);
    const endpointToMove = distToP1 < distToP2 ? arcToExtend.p1 : arcToExtend.p2;
    const isP1 = distToP1 < distToP2;
    const center = arcToExtend.center, radius = arcToExtend.radius;
    if (radius < 0.01) return;
    const ccw = arcToExtend.counterClockwise;
    const moveAngle = normalizeAngle(Math.atan2(endpointToMove.y - center.y, endpointToMove.x - center.x));
    let bestAngle = null, bestDist = Infinity;
    for (const boundary of boundarySegments) {
        const inters = lineCircleIntersections(boundary.p1, boundary.p2, center, radius);
        for (const inter of inters) {
            const angle = normalizeAngle(Math.atan2(inter.y - center.y, inter.x - center.x));
            let extendDist = isP1
                ? (ccw ? normalizeAngle(moveAngle - angle) : normalizeAngle(angle - moveAngle))
                : (ccw ? normalizeAngle(angle - moveAngle) : normalizeAngle(moveAngle - angle));
            if (extendDist > 0.02 && extendDist < Math.PI * 1.8) {
                const arcDist = radius * extendDist;
                if (arcDist < bestDist) { bestDist = arcDist; bestAngle = angle; }
            }
        }
    }
    if (bestAngle !== null) {
        const newEndpoint = new Point(center.x + radius * Math.cos(bestAngle), center.y + radius * Math.sin(bestAngle));
        const otherEndpoint = isP1 ? arcToExtend.p2 : arcToExtend.p1;
        const otherAngle = normalizeAngle(Math.atan2(otherEndpoint.y - center.y, otherEndpoint.x - center.x));
        const newSpan = ccw ? normalizeAngle(otherAngle - bestAngle) : normalizeAngle(bestAngle - otherAngle);
        const newMid = ccw ? normalizeAngle(bestAngle + newSpan / 2) : normalizeAngle(bestAngle - newSpan / 2);
        const newP3 = new Point(center.x + radius * Math.cos(newMid), center.y + radius * Math.sin(newMid));
        if (isP1) arcToExtend.p1 = newEndpoint; else arcToExtend.p2 = newEndpoint;
        arcToExtend.p3 = newP3;
        arcToExtend._compute();
    }
}

function runExtendPolylineSegment(polyline, segmentIndex, clickPt, boundarySegments) {
    const pA = polyline.points[segmentIndex], pB = polyline.points[segmentIndex + 1];
    const tempLine = new Line(pA, pB);
    runExtendLine(tempLine, clickPt, boundarySegments);
    if (Math.abs(tempLine.p1.x - pA.x) > 0.01 || Math.abs(tempLine.p1.y - pA.y) > 0.01)
        polyline.points[segmentIndex] = tempLine.p1;
    if (Math.abs(tempLine.p2.x - pB.x) > 0.01 || Math.abs(tempLine.p2.y - pB.y) > 0.01)
        polyline.points[segmentIndex + 1] = tempLine.p2;
}

// --- Offset ---
function runOffset(shape, clickPt, distance) {
    if (!shape || !(shape instanceof Line)) return;
    const dx = shape.p2.x - shape.p1.x, dy = shape.p2.y - shape.p1.y;
    const len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    const lineA = new Line(new Point(shape.p1.x + nx * distance, shape.p1.y + ny * distance), new Point(shape.p2.x + nx * distance, shape.p2.y + ny * distance));
    const lineB = new Line(new Point(shape.p1.x - nx * distance, shape.p1.y - ny * distance), new Point(shape.p2.x - nx * distance, shape.p2.y - ny * distance));
    shapes.push(lineA.distanceToPoint(clickPt) < lineB.distanceToPoint(clickPt) ? lineA : lineB);
}

// --- Move ---
function applyMoveMultiple(items, base, target) {
    const dx = target.x - base.x, dy = target.y - base.y;
    items.forEach(shape => {
        if (shape instanceof Line) { shape.p1.x += dx; shape.p1.y += dy; shape.p2.x += dx; shape.p2.y += dy; }
        else if (shape instanceof Circle) { shape.center.x += dx; shape.center.y += dy; }
        else if (shape instanceof Polyline) { shape.points.forEach(p => { p.x += dx; p.y += dy; }); }
        else if (shape instanceof Arc) {
            shape.p1.x += dx; shape.p1.y += dy; shape.p2.x += dx; shape.p2.y += dy;
            shape.p3.x += dx; shape.p3.y += dy; shape._compute();
        }
    });
}

// --- Copy ---
function copyShape(shape, dx, dy) {
    if (shape instanceof Line) return new Line(new Point(shape.p1.x + dx, shape.p1.y + dy), new Point(shape.p2.x + dx, shape.p2.y + dy));
    else if (shape instanceof Circle) return new Circle(new Point(shape.center.x + dx, shape.center.y + dy), shape.radius);
    else if (shape instanceof Polyline) return new Polyline(shape.points.map(p => new Point(p.x + dx, p.y + dy)));
    else if (shape instanceof Arc) {
        const p1 = new Point(shape.p1.x + dx, shape.p1.y + dy);
        const p2 = new Point(shape.p2.x + dx, shape.p2.y + dy);
        const p3 = new Point(shape.p3.x + dx, shape.p3.y + dy);
        return new Arc(p1, p3, p2);
    }
    return null;
}

function applyCopyMultiple(items, base, target) {
    const dx = target.x - base.x, dy = target.y - base.y;
    items.forEach(shape => {
        const copied = copyShape(shape, dx, dy);
        if (copied) shapes.push(copied);
    });
}

// --- Rotate ---
function rotatePoint(pt, center, angle) {
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    const dx = pt.x - center.x, dy = pt.y - center.y;
    return new Point(center.x + dx * cosA - dy * sinA, center.y + dx * sinA + dy * cosA);
}

function rotateShape(shape, center, angle) {
    const rp = pt => rotatePoint(pt, center, angle);
    if (shape instanceof Line) return new Line(rp(shape.p1), rp(shape.p2));
    else if (shape instanceof Circle) return new Circle(rp(shape.center), shape.radius);
    else if (shape instanceof Polyline) return new Polyline(shape.points.map(rp));
    else if (shape instanceof Arc) {
        const mp1 = rp(shape.p1), mp2 = rp(shape.p2), mp3 = rp(shape.p3);
        return new Arc(mp1, mp3, mp2);
    }
    return null;
}

function applyRotateMultiple(items, center, angle) {
    items.forEach(shape => {
        const rotated = rotateShape(shape, center, angle);
        if (rotated) shapes.push(rotated);
    });
}

function rotateShapesInPlace(items, center, angle) {
    items.forEach(shape => {
        if (shape instanceof Line) { shape.p1 = rotatePoint(shape.p1, center, angle); shape.p2 = rotatePoint(shape.p2, center, angle); }
        else if (shape instanceof Circle) shape.center = rotatePoint(shape.center, center, angle);
        else if (shape instanceof Polyline) shape.points = shape.points.map(p => rotatePoint(p, center, angle));
        else if (shape instanceof Arc) {
            shape.p1 = rotatePoint(shape.p1, center, angle); shape.p2 = rotatePoint(shape.p2, center, angle);
            shape.p3 = rotatePoint(shape.p3, center, angle); shape._compute();
        }
    });
}

// --- Mirror ---
function mirrorPoint(pt, axisP1, axisP2) {
    const dx = axisP2.x - axisP1.x, dy = axisP2.y - axisP1.y;
    const len2 = dx*dx + dy*dy;
    if (len2 < 1e-12) return new Point(pt.x, pt.y);
    const t = ((pt.x - axisP1.x)*dx + (pt.y - axisP1.y)*dy) / len2;
    const fx = axisP1.x + t*dx, fy = axisP1.y + t*dy;
    return new Point(2*fx - pt.x, 2*fy - pt.y);
}

function mirrorShape(shape, axisP1, axisP2) {
    const mp = pt => mirrorPoint(pt, axisP1, axisP2);
    if (shape instanceof Line) return new Line(mp(shape.p1), mp(shape.p2));
    else if (shape instanceof Circle) return new Circle(mp(shape.center), shape.radius);
    else if (shape instanceof Polyline) return new Polyline(shape.points.map(mp));
    else if (shape instanceof Arc) {
        const mp1 = mp(shape.p1), mp2 = mp(shape.p2), mp3 = mp(shape.p3);
        return new Arc(mp2, mp3, mp1);
    }
    return null;
}

function applyMirror(items, axisP1, axisP2) {
    items.forEach(shape => {
        const mirrored = mirrorShape(shape, axisP1, axisP2);
        if (mirrored) shapes.push(mirrored);
    });
}
