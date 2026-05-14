import axios from 'axios';

const INSPECT_URL = "https://loraxx753--mi-observatory-model-analyze.modal.run";
const COMPUTE_URL = "https://loraxx753--mi-observatory-model-compute-geometry.modal.run";

export const resolvers = {
  Query: {
    /**
     * The primary inspector: Direct GPU connection.
     */
    inspect: async (_: any, { prompt, layer, components, customEndpoint }: any) => {
      const targetUrl = customEndpoint || INSPECT_URL;

      console.log(`📡 Connection: Fetching tensors from ${targetUrl}`);

      try {
        const response = await axios.post(targetUrl, { prompt, layer, components });
        
        return {
          ...response.data,
          status: "Connection Established"
        };
      } catch (error: any) {
        console.error("❌ Connection Error:", error.message);
        throw new Error(`Failed to reach the engine at ${targetUrl}`);
      }
    },

    /**
     * The Compute Bridge: Offloads geometry math to Python/GPU.
     */
    compute: async (_: any, { prompt, layer, task, customEndpoint }: any) => {
      const targetUrl = customEndpoint || COMPUTE_URL;

      console.log(`🚀 Connection: Requesting ${task} geometry math`);

      try {
        // We first get the raw data needed for the computation
        const baseData = await axios.post(INSPECT_URL, { 
          prompt, 
          layer, 
          components: ["RESIDUAL_STREAM"] 
        });

        // Then we pass that raw math to the specialized compute endpoint
        const response = await axios.post(targetUrl, {
          residual: baseData.data.residual,
          task
        });

        return {
          ...response.data,
          status: `Connection Established: ${task}`
        };
      } catch (error: any) {
        console.error("❌ Compute Error:", error.message);
        throw new Error("Failed to execute remote geometry math.");
      }
    }
  }
};