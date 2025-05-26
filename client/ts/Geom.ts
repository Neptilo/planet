export type SphericalPosition = { theta: number; phi: number; rho: number; };

export const Geom = {
    getBoundsQuarter(bounds: number[], quarterInd: number) {
        const boundsQuarter: number[] = Array.from(bounds);
        const x = quarterInd % 2;
        const y = (quarterInd - x) / 2;
        boundsQuarter[2 * (1 - x)] = (bounds[0] + bounds[2]) / 2;
        boundsQuarter[2 * (1 - y) + 1] = (bounds[1] + bounds[3]) / 2;
        return boundsQuarter;
    },

    // returns the distance between two points represented as arrays
    // If deg is 0, the Chebyshev distance is calculated
    // If deg is 1, the Manhattan distance is calculated
    // If deg is 2 or undefined, the Euclidian distance is calculated
    dist(a: number[], b: number[], deg?: number) {
        const dim = a.length;
        if (b.length != dim) {
            console.error('Dimension mismatch in Geom.dist');
            return 0;
        }
        if (deg == undefined)
            deg = 2;
        switch (deg) {
            case 0:
                {
                    let d = 0;
                    for (let i = 0; i < dim; i++)
                        d = Math.max(d, Math.abs(b[i] - a[i]));
                    return d;
                }
            case 1:
                {
                    let d = 0;
                    for (let i = 0; i < dim; i++)
                        d += Math.abs(b[i] - a[i]);
                    return d;
                }
            case 2:
                let d2 = 0;
                for (let i = 0; i < dim; i++) {
                    const diff = b[i] - a[i];
                    d2 += diff * diff;
                }
                return Math.sqrt(d2);
            default:
                console.error('Distance of degree', deg, 'not implemented');
                return 0;
        }
    },

    // returns the distance between a point [x_0, x_1...] and bounds
    // [min_0, min_1..., max_0, max_1...] in any dimension
    pointToBoundsDistance(pt: number[], bounds: number[]) {
        const dim = pt.length;
        if (bounds.length != 2 * dim) {
            console.error('Dimension mismatch in pointToBoundsDistance');
            return 0;
        }
        const nearest: number[] = [];
        for (let i = 0; i < dim; i++) {
            nearest.push(pt[i]);
            if (nearest[i] < bounds[i])
                nearest[i] = bounds[i];
            else if (nearest[i] > bounds[dim + i])
                nearest[i] = bounds[dim + i];
        }
        return Geom.dist(pt, nearest);
    }
}
