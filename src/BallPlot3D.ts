import * as THREE from "three";
import { MeshLine, MeshLineMaterial } from "./MeshLine.js";

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

class HelixCurve extends THREE.Curve<THREE.Vector3> {
    readonly #scale: number;

    constructor(scale: number=1) {
        super();
        this.#scale = scale;
    }

    /*
    get scale(): number {
        return this.#scale;
    }
    */

    getPoint(t: number, optionalTarget=new THREE.Vector3()): THREE.Vector3 {
        const x = Math.sin(t * 30) * this.#scale;
        const y = Math.cos(t * 30) * this.#scale;
        const z = t * this.#scale;

        return optionalTarget.set(x, y, z);
    }
}

export default class BallPlot3D {
    readonly group = new THREE.Group();
    readonly #resolution: THREE.Vector2;

    constructor(resolution: THREE.Vector2) {
        this.#resolution = resolution;
    }

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
        color: number = 0xaaaaaa,
    ): void {
        const curve = new THREE.LineCurve3(
            new THREE.Vector3(start.x, start.y, start.z),
            new THREE.Vector3(end.x, end.y, end.z),
        )
        const lineGeometry = new THREE.TubeGeometry(
            curve,
            128,
            0.1,
            128,
        );

        const lineMesh = new THREE.Mesh(
            lineGeometry,
            new THREE.MeshBasicMaterial({
                color,
            }),
        );

        const backgroundLineGeometry = new THREE.TubeGeometry(
            curve,
            128,
            0.2,
            128,
        );

        const backgroundLineMesh = new THREE.Line(
            backgroundLineGeometry,
            new THREE.MeshBasicMaterial({
                color: "white",
            }),
        );

        lineMesh.renderOrder = -1;
        this.group.add(lineMesh);

        backgroundLineMesh.renderOrder = -2;
        this.group.add(backgroundLineMesh);
    }
}

