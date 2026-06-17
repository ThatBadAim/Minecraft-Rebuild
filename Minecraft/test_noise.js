import { noiseGen, getTerrainHeightAndWater } from './noise.js';

console.log("Analyzing pool generation...");

const peaksAnalyzed = new Set();
let totalCandidatePools = 0;
let enclosedPools = 0;
let rejectedPools = 0;

for (let x = -500; x < 500; x += 4) {
  for (let z = -500; z < 500; z += 4) {
    const poolNoise = noiseGen.fbm2D((x + 1000) * 0.015, (z + 1000) * 0.015, 2, 0.5, 2.0);
    if (poolNoise > 0.58) {
      // Find the peak of this candidate pool
      let currX = x;
      let currZ = z;
      let stepSize = 8.0;
      for (let i = 0; i < 6; i++) {
        const n = noiseGen.fbm2D((currX + 1000) * 0.015, (currZ + 1000) * 0.015, 2, 0.5, 2.0);
        const step = 1.0;
        const nX = noiseGen.fbm2D((currX + 1000 + step) * 0.015, (currZ + 1000) * 0.015, 2, 0.5, 2.0);
        const nZ = noiseGen.fbm2D((currX + 1000) * 0.015, (currZ + 1000 + step) * 0.015, 2, 0.5, 2.0);

        const gradX = nX - n;
        const gradZ = nZ - n;
        const len = Math.sqrt(gradX * gradX + gradZ * gradZ);
        if (len > 0.0001) {
          currX += (gradX / len) * stepSize;
          currZ += (gradZ / len) * stepSize;
        }
        stepSize *= 0.5;
      }
      const peakX = Math.round(currX);
      const peakZ = Math.round(currZ);
      const peakKey = `${peakX},${peakZ}`;

      if (!peaksAnalyzed.has(peakKey)) {
        peaksAnalyzed.add(peakKey);
        totalCandidatePools++;

        const info = getTerrainHeightAndWater(peakX, peakZ);
        // Note: ocean level is at 19, so any pool water level higher than 19 is a procedural pool
        if (info.isPool && info.waterLevel > 19) {
          enclosedPools++;
          console.log(`[ENCLOSED POOL] Peak: (${peakX}, ${peakZ}), height: ${info.height}, waterLevel: ${info.waterLevel}`);
        } else {
          rejectedPools++;
          console.log(`[REJECTED POOL] Peak: (${peakX}, ${peakZ}), uncarved height: ${info.height}`);
        }
      }
    }
  }
}

console.log(`\nSummary:`);
console.log(`Total Candidate Pools analyzed: ${totalCandidatePools}`);
console.log(`Enclosed (Spawned) Pools: ${enclosedPools}`);
console.log(`Rejected (Spilled) Pools: ${rejectedPools}`);
