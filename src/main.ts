/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
    Point,
} from "./BallPlot3D.js";
import BallPlot3D from "./BallPlot3D.js";
import render from "./render.js";

const vertexA = { x: 5, y: 5, z: 5 };
const vertexB = { x: -5, y: 5, z: -5 };
const vertexC = { x: -5, y: -5, z: 5 };
const vertexD = { x: 5, y: -5, z: -5 };

function matroid1(): BallPlot3D {
    const geoRep = new BallPlot3D();

    const vertices: Point[] = [
        vertexA,
        vertexB,
        vertexC,
        vertexD,
    ];

    for (const vertex of vertices) {
        geoRep.addVertex(vertex, 0);
    }

    for (const [idx, vertex1] of vertices.entries()) {
        for (const vertex2 of vertices.slice(idx)) {
            geoRep.addLineSegment(vertex1, vertex2, 0xaaaaaa /* Grey */);
        }
    }

    return geoRep;
}

const domElement = render(matroid1().group);

document.body.append(domElement);
