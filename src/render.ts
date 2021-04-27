import Stream from "@jsxt/stream";
import * as THREE from "three";

declare global {
    interface ReadableStream<R=any> {
        [Symbol.asyncIterator](this: ReadableStream<R>): AsyncIterator<R>;
    }
}

ReadableStream.prototype[Symbol.asyncIterator] = function() {
    const reader = this.getReader();
    return {
        next: async (_value: any) => {
            return reader.read() as any;
        },
        return: async (_value: any) => {
            return this.cancel() as any;
        },
    };
};

function dragInside(
    element: HTMLElement,
): Stream<[PointerEvent, Stream<PointerEvent>]> {
    return new Stream((controller) => {
        const onPointerDown = (event: PointerEvent) => {
            console.log(event);
            if (event.pointerType !== "mouse"
            || event.button !== 0) {
                return;
            }

            controller.yield([event, new Stream((controller) => {
                element.setPointerCapture(event.pointerId);

                const onPointerMove = controller.yield;
                const onPointerUp = () => {
                    controller.return();
                    element.releasePointerCapture(event.pointerId);
                };

                element.addEventListener("pointermove", onPointerMove);
                element.addEventListener("pointerup", onPointerUp);

                return () => {
                    element.removeEventListener("pointermove", onPointerMove);
                    element.removeEventListener("pointerup", onPointerUp);
                };
            })]);
        };

        element.addEventListener("pointerdown", onPointerDown);

        return () => {
            element.removeEventListener("pointerdown", onPointerDown);
        };
    });
}

const ROTOR_SCALE = 0.01;

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

async function rotor(
    element: HTMLElement,
    object: THREE.Object3D,
): Promise<void> {
    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp") {
            object.rotateOnWorldAxis(X_AXIS, -10 * ROTOR_SCALE);
        } else if (event.key === "ArrowDown") {
            object.rotateOnWorldAxis(X_AXIS, 10 * ROTOR_SCALE);
        } else if (event.key === "ArrowLeft") {
            object.rotateOnWorldAxis(Y_AXIS, -10 * ROTOR_SCALE);
        } else if (event.key === "ArrowRight") {
            object.rotateOnWorldAxis(Y_AXIS, 10 * ROTOR_SCALE);
        } else if (event.key === ",") {
            object.rotateOnWorldAxis(Z_AXIS, 10 * ROTOR_SCALE);
        } else if (event.key === ".") {
            object.rotateOnWorldAxis(Z_AXIS, -10 * ROTOR_SCALE);
        }
    });

    for await (const [dragStart, dragMoves] of dragInside(element)) {
        let lastEvent = dragStart;
        for await (const dragMove of dragMoves) {
            const changeX = lastEvent.clientX - dragMove.clientX;
            const changeY = lastEvent.clientY - dragMove.clientY;

            object.rotateOnWorldAxis(
                Y_AXIS,
                -changeX * ROTOR_SCALE,
            );
            object.rotateOnWorldAxis(
                X_AXIS,
                -changeY * ROTOR_SCALE,
            );

            lastEvent = dragMove;
        }
    }
}

const WIDTH = 500;
const HEIGHT = 400;

export default function render(
    object: THREE.Object3D,
): HTMLElement {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(
        15,
        WIDTH / HEIGHT,
        0.001,
        10000,
    );

    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
    });
    renderer.setSize(WIDTH, HEIGHT);
    document.body.appendChild(renderer.domElement);

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    scene.add(object);
    void rotor(renderer.domElement, object);

    const el = renderer.domElement;
    el.addEventListener("pointerdown", () => {});

    return renderer.domElement;
}
