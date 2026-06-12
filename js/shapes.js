// TraceLine CAD 2D - Geometric Shapes
// Module: shapes.js

class Point {
    constructor(x, y) { this.x = x; this.y = y; }
    distanceTo(other) { return Math.hypot(this.x - other.x, this.y - other.y); }
}

class Line {
    constructor(p1, p2) { this.p1 = p1; this.p2 = p2; this.id = Math.random(); }
    getSnapPoints() {
        return [
            { point: this.p1, type: 'endpoint' },
            { point: this.p2, type: 'endpoint' },
            { point: new Point((this.p1.x + this.p2.x)/2, (this.p1.y + this.p2.y)/2), type: 'midpoint' }
        ];
    }
    draw(ctx, selected = false) {
        ctx.beginPath(); ctx.moveTo(this.p1.x, this.p1.y); ctx.lineTo(this.p2.x, this.p2.y);
        if(selected) { ctx.strokeStyle = '#00bfff'; ctx.lineWidth = 3 / zoom; }
        ctx.stroke();
    }
    distanceToPoint(pt) {
        const A = pt.x - this.p1.x; const B = pt.y - this.p1.y;
        const C = this.p2.x - this.p1.x; const D = this.p2.y - this.p1.y;
        const dot = A * C + B * D; const len_sq = C * C + D * D;
        let param = -1; if (len_sq !== 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) { xx = this.p1.x; yy = this.p1.y; }
        else if (param > 1) { xx = this.p2.x; yy = this.p2.y; }
        else { xx = this.p1.x + param * C; yy = this.p1.y + param * D; }
        return Math.hypot(pt.x - xx, pt.y - yy);
    }
    isFullyInside(xMin, xMax, yMin, yMax) {
        return (this.p1.x >= xMin && this.p1.x <= xMax && this.p1.y >= yMin && this.p1.y <= yMax) &&
               (this.p2.x >= xMin && this.p2.x <= xMax && this.p2.y >= yMin && this.p2.y <= yMax);
    }
    intersectsBox(xMin, xMax, yMin, yMax) {
        if (this.isFullyInside(xMin, xMax, yMin, yMax)) return true;
        if (findLineIntersection(this.p1, this.p2, new Point(xMin, yMin), new Point(xMax, yMin), true)) return true;
        if (findLineIntersection(this.p1, this.p2, new Point(xMax, yMin), new Point(xMax, yMax), true)) return true;
        if (findLineIntersection(this.p1, this.p2, new Point(xMax, yMax), new Point(xMin, yMax), true)) return true;
        if (findLineIntersection(this.p1, this.p2, new Point(xMin, yMax), new Point(xMin, yMin), true)) return true;
        return false;
    }
}

class Polyline {
    constructor(points) {
        this.points = [...points];
        this.id = Math.random().toString(36).substr(2, 9);
    }
    getSnapPoints() {
        const snaps = [];
        const n = this.points.length;
        if (n < 2) return snaps;
        snaps.push({ point: this.points[0], type: 'endpoint' });
        snaps.push({ point: this.points[n - 1], type: 'endpoint' });
        for (let i = 1; i < n - 1; i++) {
            snaps.push({ point: this.points[i], type: 'vertex' });
        }
        for (let i = 0; i < n - 1; i++) {
            const mid = new Point(
                (this.points[i].x + this.points[i + 1].x) / 2,
                (this.points[i].y + this.points[i + 1].y) / 2
            );
            snaps.push({ point: mid, type: 'midpoint' });
        }
        return snaps;
    }
    draw(ctx, selected = false) {
        if (this.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.strokeStyle = selected ? '#00bfff' : '#ffffff';
        ctx.lineWidth = selected ? 3 / zoom : 2 / zoom;
        ctx.stroke();
    }
    distanceToPoint(pt) {
        let minDist = Infinity;
        for (let i = 0; i < this.points.length - 1; i++) {
            const seg = new Line(this.points[i], this.points[i + 1]);
            minDist = Math.min(minDist, seg.distanceToPoint(pt));
        }
        return minDist;
    }
    isFullyInside(xMin, xMax, yMin, yMax) {
        return this.points.every(p =>
            p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax
        );
    }
    intersectsBox(xMin, xMax, yMin, yMax) {
        if (this.isFullyInside(xMin, xMax, yMin, yMax)) return true;
        for (let i = 0; i < this.points.length - 1; i++) {
            const seg = new Line(this.points[i], this.points[i + 1]);
            if (seg.intersectsBox(xMin, xMax, yMin, yMax)) return true;
        }
        return false;
    }
}

class Circle {
    constructor(center, radius) { this.center = center; this.radius = radius; this.id = Math.random(); }
    getSnapPoints() {
        const c = this.center; const r = this.radius;
        return [
            { point: c, type: 'center' },
            { point: new Point(c.x, c.y - r), type: 'quadrant' },
            { point: new Point(c.x + r, c.y), type: 'quadrant' },
            { point: new Point(c.x, c.y + r), type: 'quadrant' },
            { point: new Point(c.x - r, c.y), type: 'quadrant' }
        ];
    }
    draw(ctx, selected = false) {
        ctx.beginPath(); ctx.arc(this.center.x, this.center.y, this.radius, 0, 2 * Math.PI);
        if(selected) { ctx.strokeStyle = '#00bfff'; ctx.lineWidth = 3 / zoom; }
        ctx.stroke();
    }
    distanceToPoint(pt) { return Math.abs(this.center.distanceTo(pt) - this.radius); }
    isFullyInside(xMin, xMax, yMin, yMax) {
        return (this.center.x - this.radius >= xMin && this.center.x + this.radius <= xMax &&
                this.center.y - this.radius >= yMin && this.center.y + this.radius <= yMax);
    }
    intersectsBox(xMin, xMax, yMin, yMax) {
        if (this.isFullyInside(xMin, xMax, yMin, yMax)) return true;
        let closestX = Math.max(xMin, Math.min(this.center.x, xMax));
        let closestY = Math.max(yMin, Math.min(this.center.y, yMax));
        return this.center.distanceTo(new Point(closestX, closestY)) <= this.radius;
    }
}

function circumcircle(p1, p2, p3) {
    const ax = p1.x, ay = p1.y;
    const bx = p2.x, by = p2.y;
    const cx = p3.x, cy = p3.y;
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(D) < 1e-10) return null;
    const ux = ((ax*ax + ay*ay) * (by - cy) + (bx*bx + by*by) * (cy - ay) + (cx*cx + cy*cy) * (ay - by)) / D;
    const uy = ((ax*ax + ay*ay) * (cx - bx) + (bx*bx + by*by) * (ax - cx) + (cx*cx + cy*cy) * (bx - ax)) / D;
    const center = new Point(ux, uy);
    const radius = center.distanceTo(p1);
    return { center, radius };
}

function normalizeAngle(a) { return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); }

function angleInArc(angle, startA, endA) {
    angle = normalizeAngle(angle);
    startA = normalizeAngle(startA);
    endA = normalizeAngle(endA);
    if (startA <= endA) return angle >= startA && angle <= endA;
    return angle >= startA || angle <= endA;
}

class Arc {
    constructor(p1, p3, p2) {
        this.p1 = p1; this.p3 = p3; this.p2 = p2;
        this.id = Math.random();
        this._compute();
    }
    _compute() {
        const cc = circumcircle(this.p1, this.p3, this.p2);
        if (!cc) { this.valid = false; return; }
        this.valid = true;
        this.center = cc.center;
        this.radius = cc.radius;
        this.startAngle = normalizeAngle(Math.atan2(this.p1.y - this.center.y, this.p1.x - this.center.x));
        this.endAngle   = normalizeAngle(Math.atan2(this.p2.y - this.center.y, this.p2.x - this.center.x));
        const midTestAngle = normalizeAngle(Math.atan2(this.p3.y - this.center.y, this.p3.x - this.center.x));
        const ccwIncludes = angleInArc(midTestAngle, this.startAngle, this.endAngle);
        this.counterClockwise = ccwIncludes;
    }
    getSnapPoints() {
        if (!this.valid) return [];
        let midAngle;
        const sa = this.startAngle, ea = this.endAngle;
        if (this.counterClockwise) {
            midAngle = sa <= ea ? (sa + ea) / 2 : normalizeAngle(sa + (normalizeAngle(ea - sa + 2*Math.PI)) / 2);
        } else {
            midAngle = ea <= sa ? (sa + ea) / 2 : normalizeAngle(ea + (normalizeAngle(sa - ea + 2*Math.PI)) / 2);
        }
        const midPt = new Point(this.center.x + this.radius * Math.cos(midAngle), this.center.y + this.radius * Math.sin(midAngle));
        return [
            { point: this.p1, type: 'endpoint' },
            { point: this.p2, type: 'endpoint' },
            { point: midPt, type: 'midpoint' },
            { point: this.center, type: 'center' }
        ];
    }
    draw(ctx, selected = false) {
        if (!this.valid) return;
        if (selected) { ctx.strokeStyle = '#00bfff'; ctx.lineWidth = 3 / zoom; }
        ctx.beginPath();
        if (this.counterClockwise) {
            ctx.arc(this.center.x, this.center.y, this.radius, this.startAngle, this.endAngle, false);
        } else {
            ctx.arc(this.center.x, this.center.y, this.radius, this.startAngle, this.endAngle, true);
        }
        ctx.stroke();
    }
    distanceToPoint(pt) {
        if (!this.valid) return Infinity;
        const angle = normalizeAngle(Math.atan2(pt.y - this.center.y, pt.x - this.center.x));
        const onArc = this.counterClockwise ? angleInArc(angle, this.startAngle, this.endAngle)
                                            : angleInArc(angle, this.endAngle, this.startAngle);
        if (onArc) return Math.abs(this.center.distanceTo(pt) - this.radius);
        return Math.min(pt.distanceTo(this.p1), pt.distanceTo(this.p2));
    }
    isFullyInside(xMin, xMax, yMin, yMax) {
        if (!this.valid) return false;
        return this.p1.x >= xMin && this.p1.x <= xMax && this.p1.y >= yMin && this.p1.y <= yMax &&
               this.p2.x >= xMin && this.p2.x <= xMax && this.p2.y >= yMin && this.p2.y <= yMax &&
               this.p3.x >= xMin && this.p3.x <= xMax && this.p3.y >= yMin && this.p3.y <= yMax;
    }
    intersectsBox(xMin, xMax, yMin, yMax) {
        if (this.isFullyInside(xMin, xMax, yMin, yMax)) return true;
        if (this.distanceToPoint(new Point(Math.max(xMin, Math.min(this.center.x, xMax)),
                                            Math.max(yMin, Math.min(this.center.y, yMax)))) <= this.radius + 0.01) return true;
        return false;
    }
}
