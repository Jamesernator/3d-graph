/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
    Point,
} from "./BallPlot3D.js";
import BallPlot3D from "./BallPlot3D.js";
import render from "./render.js";
import type * as THREE from "three";

const vertexA = { x: 5, y: 5, z: 5 };
const vertexB = { x: -5, y: 5, z: -5 };
const vertexC = { x: -5, y: -5, z: 5 };
const vertexD = { x: 5, y: -5, z: -5 };

function matroid1({ resolution }: { resolution: THREE.Vector2 }) {
    const geoRep = new BallPlot3D(resolution);

    const vertices: Point[] = [
        { x: 0, y: 0, z: 0 },
        vertexA,
        vertexB,
        vertexC,
        vertexD,
    ];

    for (const vertex of vertices) {
        geoRep.addVertex(vertex);
    }

    for (const [idx, vertex1] of vertices.entries()) {
        for (const vertex2 of vertices.slice(idx + 1)) {
            geoRep.addLineSegment(vertex1, vertex2, 0xaaaaff /* Grey */);
        }
    }

    return geoRep.group;
}

const domElement = render(matroid1);

document.body.append(domElement);
