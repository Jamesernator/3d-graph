import * as THREE from "three";

THREE.ShaderChunk.meshline_vert = `
    attribute vec3 previous;
    attribute vec3 next;
    attribute float side;
    attribute float width;
    attribute float counters;

    uniform vec2 resolution;
    uniform float lineWidth;
    uniform vec3 color;
    uniform float opacity;
    uniform float sizeAttenuation;
    
    varying vec2 vUV;
    varying vec4 vColor;
    varying float vCounters;
    
    vec2 fix( vec4 i, float aspect ) {
        vec2 res = i.xy / i.w;
        res.x *= aspect;
        vCounters = counters;
        return res;
    }
    
    void main() {
        float aspect = resolution.x / resolution.y;

        vColor = vec4( color, opacity );
        vUV = uv;

        mat4 m = projectionMatrix * modelViewMatrix;
        vec4 finalPosition = m * vec4( position, 1.0 );
        vec4 prevPos = m * vec4( previous, 1.0 );
        vec4 nextPos = m * vec4( next, 1.0 );

        vec2 currentP = fix( finalPosition, aspect );
        vec2 prevP = fix( prevPos, aspect );
        vec2 nextP = fix( nextPos, aspect );

        float w = lineWidth * width;

        vec2 dir;
        if( nextP == currentP ) dir = normalize( currentP - prevP );
        else if( prevP == currentP ) dir = normalize( nextP - currentP );
        else {
            vec2 dir1 = normalize( currentP - prevP );
            vec2 dir2 = normalize( nextP - currentP );
            dir = normalize( dir1 + dir2 );
        }

        vec4 normal = vec4( -dir.y, dir.x, 0., 1. );
        normal.xy *= .5 * w;
        normal *= projectionMatrix;
        if( sizeAttenuation == 0. ) {
            normal.xy *= finalPosition.w;
            normal.xy /= ( vec4( resolution, 0., 1. ) * projectionMatrix ).xy;
        }
    
        finalPosition.xy += normal.xy * side;
    
        gl_Position = finalPosition;
    }
`;

THREE.ShaderChunk.meshline_frag = `
    uniform sampler2D map;
    uniform sampler2D alphaMap;
    uniform float useMap;
    uniform float useAlphaMap;
    uniform float useDash;
    uniform float dashArray;
    uniform float dashOffset;
    uniform float dashRatio;
    uniform float visibility;
    uniform float alphaTest;
    uniform vec2 repeat;

    varying vec2 vUV;
    varying vec4 vColor;
    varying float vCounters;

    void main() {
        vec4 c = vColor;
        if( useMap == 1. ) c *= texture2D( map, vUV * repeat );
        if( useAlphaMap == 1. ) c.a *= texture2D( alphaMap, vUV * repeat ).a;
        if( c.a < alphaTest ) discard;
        if( useDash == 1. ){
            c.a *= ceil(mod(vCounters + dashOffset, dashArray) - (dashArray * dashRatio));
        }
        gl_FragColor = c;
        gl_FragColor.a *= step(vCounters, visibility);
        gl_FragColor = vec4(0.5, 0.5, 0.5, visibility);
    }
`;

type ComputeWidth = (distance: number) => number;

function assert(cond: boolean): asserts cond {
    if (!cond) {
        throw new Error("Assertion failed");
    }
}

type Attributes = {
    position: THREE.BufferAttribute,
    previous: THREE.BufferAttribute,
    next: THREE.BufferAttribute,
    side: THREE.BufferAttribute,
    width: THREE.BufferAttribute,
    uv: THREE.BufferAttribute,
    index: THREE.BufferAttribute,
    counters: THREE.BufferAttribute,
}

function memcpy(
    src: Array<number>,
    srcOffset: number,
    dst: Array<number>,
    dstOffset: number,
    length: number
) {
    for (let i = 0; i < length; i += 1) {
        dst[i + dstOffset] = src[i + srcOffset]!;
    }

    return dst
  }

export class MeshLine extends THREE.BufferGeometry {
    readonly type = "MeshLine";
    positions: Float32Array = new Float32Array();
    previous: Float32Array = new Float32Array();
    next: Float32Array = new Float32Array();
    side: number[] = [];
    width: number[] = [];
    indicesArray: Float32Array = new Float32Array();
    uvs: number[] = [];
    counters: Float32Array = new Float32Array();
    computeWidth: ComputeWidth | null = null;
    matrixWorld = new THREE.Matrix4();
    #attributes: Attributes | null = null;
    #points: THREE.Vector3[] = [];
    #geom = null;

    get isMeshLine(): boolean {
        return true;
    }

    get geometry(): MeshLine {
        return this;
    }

    get geom(): unknown[] | null {
        return this.#geom;
    }

    get points(): THREE.Vector3[] {
        return this.#points;
    }

    set points(points: THREE.Vector3[]) {
        this.setPoints(points, this.computeWidth)
    }

    #setPoints(
        points: THREE.Vector3[], 
        computeWidth: ComputeWidth | null,
    ): void {
        this.#points = points;
        this.computeWidth = computeWidth;
        this.positions = new Float32Array(points.length * 6);
        this.counters = new Float32Array(points.length * 2);
        for (const [idx, point] of points.entries()) {
            this.positions.set([point.x, point.y, point.z], idx * 6);
            this.positions.set([point.x, point.y, point.z], idx * 6 + 3);
            this.counters[idx*2] = idx / points.length;
            this.counters[idx*2+1] = idx / points.length;
        }
        this.#process();
    }

    setPoints(
        points: THREE.Vector3[], 
        computeWidth: ComputeWidth | null=this.computeWidth
    ): void {
        return this.#setPoints(points, computeWidth);
    }

    #equalVec3(a: number, b: number): boolean {
        const aStart = a*6;
        const bStart = b*6;

        return this.positions[aStart] === this.positions[bStart]
            && this.positions[aStart + 1] === this.positions[bStart + 1]
            && this.positions[aStart + 2] === this.positions[bStart + 2];
    }

    #vec3(n: number): [number, number, number] {
        const start = n*6;
        const x = this.positions[start];
        const y = this.positions[start + 1];
        const z = this.positions[start + 2];
        assert(x !== undefined && y !== undefined && z !== undefined);
        return [x, y, z];
    }

    #process(): void {
        const l = this.positions.length / 6;

        this.previous = new Float32Array(this.positions.length);
        this.next = new Float32Array(this.positions.length);
        this.side = [];
        this.indicesArray = new Float32Array(this.positions.length);
        this.uvs = [];
        
        const v1 = this.#equalVec3(0, l - 1) ? this.#vec3(l-2) : this.#vec3(0);

        this.previous.set(v1, 0);
        this.previous.set(v1, 3);

        for (let j = 0; j < l; j++) {
            this.side.push(1);
            this.side.push(-1);

            const w = this.computeWidth?.(j / (l - 1)) ?? 1;
            this.width.push(w);
            this.width.push(w);

            this.uvs.push(j / (l-1), 0);
            this.uvs.push(j / (l-1), 0);

            if (j < l - 1) {
                const v = this.#vec3(j);
                this.previous.set(v, (j + 1)*6);
                this.previous.set(v, (j + 1)*6 + 1);

                const n = j * 2;
                this.indicesArray.set([n, n + 1, n + 2], j*6);
                this.indicesArray.set([n + 2, n + 1, n + 3], j*6 + 3);
            }
            if (j > 0) {
                const v = this.#vec3(j);
                this.next.set(v, (j - 1)*6);
                this.next.set(v, (j - 1)*6 + 1);
            }
        }

        const v2 = this.#equalVec3(l - 1, 0) 
            ? this.#vec3(1) 
            : this.#vec3(l - 1);

        this.next.set(v2, l*6 - 6);
        this.next.set(v2, l*6 - 3);

        if (!this.#attributes 
        || this.#attributes.position.count !== this.positions.length) {
            this.#attributes = {
                position: new THREE.BufferAttribute(this.positions, 3),
                previous: new THREE.BufferAttribute(
                    new Float32Array(this.previous), 
                    3
                ),
                next: new THREE.BufferAttribute(
                    new Float32Array(this.next),
                    3,
                ),
                side: new THREE.BufferAttribute(
                    new Float32Array(this.side),
                    1,
                ),
                width: new THREE.BufferAttribute(
                    new Float32Array(this.width),
                    1,
                ),
                uv: new THREE.BufferAttribute(
                    new Float32Array(this.uvs),
                    2,
                ),
                index: new THREE.BufferAttribute(
                    new Uint16Array(this.indicesArray),
                    1,
                ),
                counters: new THREE.BufferAttribute(
                    new Float32Array(this.counters),
                    1,
                ),
            }
        } else {
            this.#attributes.position.copyArray(
                new Float32Array(this.positions)
            )
            this.#attributes.position.needsUpdate = true
            this.#attributes.previous.copyArray(new Float32Array(this.previous))
            this.#attributes.previous.needsUpdate = true;
            this.#attributes.next.copyArray(new Float32Array(this.next))
            this.#attributes.next.needsUpdate = true;
            this.#attributes.side.copyArray(new Float32Array(this.side));
            this.#attributes.side.needsUpdate = true;
            this.#attributes.width.copyArray(new Float32Array(this.width));
            this.#attributes.width.needsUpdate = true;
            this.#attributes.uv.copyArray(new Float32Array(this.uvs));
            this.#attributes.uv.needsUpdate = true;
            this.#attributes.index.copyArray(
                new Uint16Array(this.indicesArray)
            )
            this.#attributes.index.needsUpdate = true;
        }

        this.setAttribute("position", this.#attributes.position);
        this.setAttribute("previous", this.#attributes.previous);
        this.setAttribute("next", this.#attributes.next);
        this.setAttribute("side", this.#attributes.side);
        this.setAttribute("width", this.#attributes.width);
        this.setAttribute("uv", this.#attributes.uv);
        this.setAttribute("counters", this.#attributes.counters);
        
        this.setIndex(this.#attributes.index);

        this.computeBoundingSphere();
        this.computeBoundingBox();
    }

    advance(position: THREE.Vector3): void {
        assert(this.#attributes !== null);
        const positions = this.#attributes.position.array as Array<number>;;
        const previous = this.#attributes.previous.array as Array<number>;
        const next = this.#attributes.next.array as Array<number>;
        const l = positions.length;
  
        // PREVIOUS
        memcpy(positions, 0, previous, 0, l);
  
        // POSITIONS
        memcpy(positions, 6, positions, 0, l - 6);
  
        positions[l - 6] = position.x;
        positions[l - 5] = position.y;
        positions[l - 4] = position.z;
        positions[l - 3] = position.x;
        positions[l - 2] = position.y;
        positions[l - 1] = position.z;
  
        // NEXT
        memcpy(positions, 6, next, 0, l - 6);
  
        next[l - 6] = position.x
        next[l - 5] = position.y
        next[l - 4] = position.z;
        next[l - 3] = position.x;
        next[l - 2] = position.y;
        next[l - 1] = position.z;
  
        this.#attributes.position.needsUpdate = true;
        this.#attributes.previous.needsUpdate = true;
        this.#attributes.next.needsUpdate = true;
    }
}

export interface MeshLineMaterialParameters extends THREE.ShaderMaterialParameters {
    resolution: THREE.Vector2,
    lineWidth?: number,
    map?: null | THREE.Texture,
    useMap?: 0 | 1,
    alphaMap?: null | THREE.Texture,
    useAlphaMap?: 0 | 1,
    color?: THREE.Color,
    opacity?: number,
    alphaTest?: number,
    dashArray?: number,
    dashOffset?: number,
    dashRatio?: number,
    sizeAttentuation?: 0 | 1,
}

export class MeshLineMaterial extends THREE.ShaderMaterial {
    readonly type = "MeshLineMaterial";

    constructor(options: MeshLineMaterialParameters) {
        super({
            uniforms: {
                ...THREE.UniformsLib.fog,
                lineWidth: { value: 1 },
                map: { value: null },
                useMap: { value: 0 },
                alphaMap: { value: null },
                useAlphaMap: { value: 0 },
                color: { value: new THREE.Color(0x000000) },
                opacity: { value: 1 },
                resolution: { value: new THREE.Vector2(1, 1) },
                sizeAttenuation: { value: 1 },
                dashArray: { value: 0 },
                dashOffset: { value: 0 },
                dashRatio: { value: 0.5 },
                useDash: { value: 0 },
                visibility: { value: 1 },
                alphaTest: { value: 0 },
                repeat: { value: new THREE.Vector2(1, 1) },
            },

            vertexShader: THREE.ShaderChunk.meshline_vert,

            fragmentShader: THREE.ShaderChunk.meshline_frag,
        });

        this.setValues(options);
    }

    get lineWidth(): number {
        return this.uniforms.lineWidth!.value;
    }

    set lineWidth(lineWidth: number) {
        this.uniforms.lineWidth!.value = lineWidth;
    }

    get map(): null | THREE.Texture {
        return this.uniforms.map!.value;
    }

    set map(map: null | THREE.Texture) {
        this.uniforms.map!.value = map;
    }

    get useMap(): 0 | 1 {
        return this.uniforms.useMap!.value;
    }

    set useMap(useMap: 0 | 1) {
        this.uniforms.useMap!.value = useMap;
    }

    get alphaMap(): null | THREE.Texture {
        return this.uniforms.alphaMap!.value;
    }

    set alphaMap(alphaMap: null | THREE.Texture) {
        this.uniforms.alphaMap!.value = alphaMap;
    }

    get useAlphaMap(): 0 | 1 {
        return this.uniforms.useAlphaMap!.value;
    }

    set useAlphaMap(useAlphaMap: 0 | 1) {
        this.uniforms.useAlphaMap!.value;
    }

    get color(): THREE.Color {
        return this.uniforms.color!.value;
    }

    set color(color: THREE.Color) {
        this.uniforms.color!.value;
    }

    get resolution(): THREE.Vector2 {
        return this.uniforms.resolution!.value;
    }

    set resolution(resolution: THREE.Vector2) {
        this.uniforms.resolution!.value.copy(resolution);
    }

    get sizeAttentuation(): 0 | 1 {
        return this.uniforms.sizeAttenuation!.value;
    }

    set sizeAttentuation(sizeAttentuation: 0 | 1) {
        this.uniforms.sizeAttenuation!.value = sizeAttentuation;
    }

    get dashArray(): number {
        return this.uniforms.dashArray!.value;
    }

    set dashArray(dashArray: number) {
        this.uniforms.dashArray!.value = dashArray;
    }

    get dashOffset(): number {
        return this.uniforms.dashOffset!.value;
    }

    set dashOffset(dashOffset: number) {
        this.uniforms.dashOffset!.value = dashOffset;
    }

    get dashRatio(): number {
        return this.uniforms.dashRatio!.value;
    }

    set dashRatio(dashRatio: number) {
        this.uniforms.dashRatio!.value = dashRatio;
    }

    get useDash(): 0 | 1 {
        return this.uniforms.useDash!.value;
    }

    set useDash(useDash: 0 | 1) {
        this.uniforms.useDash!.value = useDash;
    }

    get visibility(): 0 | 1 {
        return this.uniforms.visibility!.value;
    }

    set visibility(visibility: 0 | 1) {
        this.uniforms.visibility!.value = visibility;
    }

    get repeat(): THREE.Vector2 {
        return this.uniforms.repeat!.value;
    }

    set repeat(repeat: THREE.Vector2) {
        this.uniforms.repeat!.value.copy(repeat);
    }
}
