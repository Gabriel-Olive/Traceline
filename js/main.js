// TraceLine CAD 2D - Main Entry Point
// Module: main.js

// File I/O
function serializeShape(shape) {
    if (shape instanceof Line) return { type: 'line', p1: {x: shape.p1.x, y: shape.p1.y}, p2: {x: shape.p2.x, y: shape.p2.y} };
    else if (shape instanceof Circle) return { type: 'circle', center: {x: shape.center.x, y: shape.center.y}, radius: shape.radius };
    else if (shape instanceof Polyline) return { type: 'polyline', points: shape.points.map(p => ({x: p.x, y: p.y})) };
    else if (shape instanceof Arc) return { type: 'arc', p1: {x: shape.p1.x, y: shape.p1.y}, p2: {x: shape.p2.x, y: shape.p2.y}, p3: {x: shape.p3.x, y: shape.p3.y} };
    return null;
}

function deserializeShape(data) {
    if (data.type === 'line') return new Line(new Point(data.p1.x, data.p1.y), new Point(data.p2.x, data.p2.y));
    else if (data.type === 'circle') return new Circle(new Point(data.center.x, data.center.y), data.radius);
    else if (data.type === 'polyline') return new Polyline(data.points.map(p => new Point(p.x, p.y)));
    else if (data.type === 'arc') return new Arc(new Point(data.p1.x, data.p1.y), new Point(data.p3.x, data.p3.y), new Point(data.p2.x, data.p2.y));
    return null;
}

function saveDrawing() {
    const data = { version: '1.0', shapes: shapes.map(s => serializeShape(s)), zoom, panX, panY };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `traceline_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
}

function loadDrawing() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                shapes = []; selectedShapes = [];
                if (data.shapes && Array.isArray(data.shapes))
                    data.shapes.forEach(s => { const shape = deserializeShape(s); if (shape) shapes.push(shape); });
                if (data.zoom) zoom = data.zoom;
                if (data.panX !== undefined) panX = data.panX;
                if (data.panY !== undefined) panY = data.panY;
                clearSelection(); resetState();
            } catch (err) { alert('Erro ao carregar: ' + err.message); }
        };
        reader.readAsText(file);
    };
    input.click();
}
