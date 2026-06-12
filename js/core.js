// TraceLine CAD 2D - Core State & Utilities
// Module: core.js

// --- Global State ---
let shapes = [];
let currentMode = 'line';
let currentPoints = [];

let screenMousePos = new Point(0, 0);
let computedPt = new Point(0, 0);
let currentPolarAngle = null;

let zoom = 1.0;
let panX = 0, panY = 0;
let isPanning = false, startPan = { x: 0, y: 0 };

let activeSnap = null;
let trackedPoints = [];
let activeOTrackLines = [];

let selectedShapes = [];
let moveBasePoint = null;
let offsetDistance = 50;
let selectionPhase = "select";
let mirrorAxisP1 = null;
let copyBasePoint = null;
let rotateBasePoint = null;
let rotateAngle = null;
let extendPhase = "boundary";
let extendBoundaries = [];
let selectionStartPt = null;
let isSelectingBox = false;

const SNAP_TOLERANCE_SCREEN = 15;
const POLAR_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const POLAR_TOLERANCE = 4 * (Math.PI / 180);

function screenToModel(sPt) { return new Point((sPt.x - panX) / zoom, (sPt.y - panY) / zoom); }

function findLineIntersection(p1, p2, p3, p4, limitToSegments = false) {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(denom) < 0.0001) return null;
    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
    if (limitToSegments && (ua < 0 || ua > 1 || ub < 0 || ub > 1)) return null;
    return new Point(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
}

function getAllPhysicalSegments() {
    let segments = [];
    shapes.forEach(shape => {
        if (shape instanceof Line) segments.push(shape);
        else if (shape instanceof Polyline) {
            for (let i = 0; i < shape.points.length - 1; i++) {
                segments.push(new Line(shape.points[i], shape.points[i+1]));
            }
        }
    });
    return segments;
}

function getAllSnapPoints() {
    const snaps = [];
    shapes.forEach(shape => snaps.push(...shape.getSnapPoints()));
    return snaps;
}

function pointToInfiniteLineDist(pt, lineP1, lineP2) {
    const A = pt.x - lineP1.x, B = pt.y - lineP1.y, C = lineP2.x - lineP1.x, D = lineP2.y - lineP1.y;
    const dot = A * C + B * D, lenSq = C * C + D * D;
    if (lenSq === 0) return pt.distanceTo(lineP1);
    const proj = dot / lenSq;
    return Math.hypot(pt.x - (lineP1.x + proj * C), pt.y - (lineP1.y + proj * D));
}

function lineCircleIntersections(p1, p2, center, radius) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const fx = p1.x - center.x, fy = p1.y - center.y;
    const a = dx*dx + dy*dy;
    if (a < 1e-12) return [];
    const b = 2*(fx*dx + fy*dy), c = fx*fx + fy*fy - radius*radius;
    const disc = b*b - 4*a*c;
    if (disc < 0) return [];
    const sqrtD = Math.sqrt(disc);
    const results = [];
    const t1 = (-b - sqrtD) / (2*a), t2 = (-b + sqrtD) / (2*a);
    if (t1 >= -1e-9 && t1 <= 1+1e-9) results.push(new Point(p1.x + t1*dx, p1.y + t1*dy));
    if (disc > 1e-10 && t2 >= -1e-9 && t2 <= 1+1e-9) results.push(new Point(p1.x + t2*dx, p1.y + t2*dy));
    return results;
}

function circleCircleIntersections(c1, r1, c2, r2) {
    const d = c1.distanceTo(c2);
    if (d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9 || d < 1e-9) return [];
    const a = (r1*r1 - r2*r2 + d*d) / (2*d);
    const h2 = r1*r1 - a*a;
    if (h2 < 0) return [];
    const h = Math.sqrt(h2);
    const mx = c1.x + a*(c2.x - c1.x)/d, my = c1.y + a*(c2.y - c1.y)/d;
    if (h < 1e-9) return [new Point(mx, my)];
    const px = h*(c2.y - c1.y)/d, py = h*(c2.x - c1.x)/d;
    return [new Point(mx + px, my - py), new Point(mx - px, my + py)];
}

function filterPointsOnArc(pts, arc) {
    return pts.filter(p => {
        const a = normalizeAngle(Math.atan2(p.y - arc.center.y, p.x - arc.center.x));
        return arc.counterClockwise ? angleInArc(a, arc.startAngle, arc.endAngle)
                                    : angleInArc(a, arc.endAngle, arc.startAngle);
    });
}

function anglesClose(a, b, eps = 0.005) {
    const d = normalizeAngle(a - b);
    return d < eps || d > 2*Math.PI - eps;
}

function makeArcFromAngles(center, radius, startAngle, endAngle, counterClockwise) {
    let midAngle;
    if (counterClockwise) {
        const span = normalizeAngle(endAngle - startAngle);
        midAngle = normalizeAngle(startAngle + span / 2);
    } else {
        const span = normalizeAngle(startAngle - endAngle);
        midAngle = normalizeAngle(endAngle + span / 2);
    }
    const p1 = new Point(center.x + radius * Math.cos(startAngle), center.y + radius * Math.sin(startAngle));
    const p2 = new Point(center.x + radius * Math.cos(endAngle),   center.y + radius * Math.sin(endAngle));
    const p3 = new Point(center.x + radius * Math.cos(midAngle),   center.y + radius * Math.sin(midAngle));
    return new Arc(p1, p3, p2);
}

function collectCircleIntersectionAngles(targetId, center, radius, isArc, startA, endA, ccw) {
    let angles = [];
    shapes.forEach(other => {
        if (other.id === targetId) return;
        let pts = [];
        if (other instanceof Line) pts = lineCircleIntersections(other.p1, other.p2, center, radius);
        else if (other instanceof Circle) pts = circleCircleIntersections(center, radius, other.center, other.radius);
        else if (other instanceof Arc && other.valid) {
            pts = circleCircleIntersections(center, radius, other.center, other.radius);
            pts = filterPointsOnArc(pts, other);
        }
        if (isArc) {
            pts = pts.filter(p => {
                const a = normalizeAngle(Math.atan2(p.y - center.y, p.x - center.x));
                const onArc = ccw ? angleInArc(a, startA, endA) : angleInArc(a, endA, startA);
                return onArc && !anglesClose(a, startA) && !anglesClose(a, endA);
            });
        }
        pts.forEach(p => {
            const a = normalizeAngle(Math.atan2(p.y - center.y, p.x - center.x));
            if (!angles.some(ia => anglesClose(ia, a))) angles.push(a);
        });
    });
    return angles;
}
