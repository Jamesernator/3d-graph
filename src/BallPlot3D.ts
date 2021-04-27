import * as THREE from "three";

export type Point = {
    x: number,
    y: number,
    z: number,
};

const sphereGeometry = new THREE.SphereGeometry(
    0.7, // Radius
    64, // Number of longitude lines for triangle generation
    64, // Number of latitude lines for triangle generation
);

// Smooth the sphere geometry
sphereGeometry.computeVertexNormals();

export default class BallPlot3D {
    readonly group = new THREE.Group();

    addVertex(position: Point, color: number = 0x0): void {
        const sphere = new THREE.Mesh(
            sphereGeometry,
            new THREE.MeshBasicMaterial({
                color,
            }),
        );
        sphere.translateX(position.x);
        sphere.translateY(position.y);
        sphere.translateZ(position.z);
        this.group.add(sphere);
    }

    addLineSegment(
        start: Point,
        end: Point,
        color: number = 0x777777,
    ): void {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(
            [
                new THREE.Vector3(
                    start.x,
                    start.y,
                    start.z,
                ),
                new THREE.Vector3(end.x, end.y, end.z),
            ],
        );
        const line = new THREE.Line(
            lineGeometry,
            new THREE.LineBasicMaterial({
                color,
                linewidth: 3,
            }),
        );
        const backgroundLine = new THREE.Line(
            lineGeometry,
            new THREE.LineBasicMaterial({
                color: 0xffffff,
                linewidth: 160,
            }),
        );
        line.renderOrder = -1;
        backgroundLine.renderOrder = -2;
        this.group.add(line, backgroundLine);
    }
}

